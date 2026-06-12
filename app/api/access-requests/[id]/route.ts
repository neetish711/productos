import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ROLE_DEFAULTS } from '@/lib/permissions'

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
      const assignedRole = body.role || request.requestedRole
      const defaultPermissions = ROLE_DEFAULTS[assignedRole] || ROLE_DEFAULTS.VIEWER

      // Update the pending user to approved
      const user = await prisma.user.findFirst({
        where: { email: request.email, status: 'PENDING' },
      })

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: assignedRole,
            status: 'APPROVED',
            permissionsJson: JSON.stringify(defaultPermissions),
          },
        })

        // Assign product access
        const productIds = body.productIds || JSON.parse(request.requestedProductsJson || '[]')
        if (productIds.length > 0) {
          await (prisma.userProductAccess.createMany as any)({
            data: productIds.map((pid: string) => ({ userId: user.id, productId: pid })),
            skipDuplicates: true,
          })
        } else {
          // Grant access to all products in the org
          const products = await prisma.product.findMany({
            where: { organizationId: session.user.organizationId },
            select: { id: true },
          })
          if (products.length > 0) {
            await (prisma.userProductAccess.createMany as any)({
              data: products.map((p) => ({ userId: user.id, productId: p.id })),
              skipDuplicates: true,
            })
          }
        }
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
      // Reject
      await prisma.accessRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
        },
      })

      // Also mark the pending user as rejected
      const user = await prisma.user.findFirst({
        where: { email: request.email, status: 'PENDING' },
      })
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'REJECTED' },
        })
      }
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
