import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ROLE_DEFAULTS, canAssignRole } from '@/lib/permissions'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  role: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  reviewNote: z.string().optional(),
})

// PATCH - Approve or reject an access request
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = reviewSchema.parse(await req.json())
    const request = await prisma.accessRequest.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    })

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 })
    }

    if (body.action === 'APPROVE') {
      if (!request.organizationId) {
        return NextResponse.json({ error: 'Request has no organization to approve into' }, { status: 400 })
      }
      if (!request.passwordHash) {
        return NextResponse.json({ error: 'Request predates the new flow and has no stored password. Ask the applicant to re-submit.' }, { status: 400 })
      }

      // AUDIT S2-8: the granted role is chosen by the admin (defaults to the
      // lowest role), NOT the applicant's requestedRole, and must be within the
      // reviewer's assignable range.
      const assignedRole = body.role || 'VIEWER'
      if (!canAssignRole(role, assignedRole)) {
        return NextResponse.json({ error: `You are not permitted to assign the role ${assignedRole}` }, { status: 403 })
      }
      const defaultPermissions = ROLE_DEFAULTS[assignedRole] || ROLE_DEFAULTS.VIEWER

      // AUDIT S2-8: the User is created here (on approval), not at request time.
      const existing = await prisma.user.findUnique({ where: { email: request.email } })
      if (existing) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
      }
      const user = await prisma.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: assignedRole,
          status: 'APPROVED',
          organizationId: request.organizationId,
          permissionsJson: JSON.stringify(defaultPermissions),
        },
      })

      // Assign product access (verify products belong to this org — AUDIT P0-9 pattern).
      const requestedIds: string[] = body.productIds || JSON.parse(request.requestedProductsJson || '[]')
      const orgProducts = await prisma.product.findMany({
        where: { organizationId: request.organizationId, ...(requestedIds.length > 0 ? { id: { in: requestedIds } } : {}) },
        select: { id: true },
      })
      if (orgProducts.length > 0) {
        await (prisma.userProductAccess.createMany as any)({
          data: orgProducts.map((p) => ({ userId: user.id, productId: p.id })),
          skipDuplicates: true,
        })
      }

      await prisma.accessRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
        },
      })
    } else {
      // Reject — no User was ever created, so just close the request.
      await prisma.accessRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('Review error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
