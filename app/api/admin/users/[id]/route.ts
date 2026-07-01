import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import {
  canAccessAdminPanel,
  canAssignRole,
  isAdmin,
  ROLE_HIERARCHY,
  ALL_PERMISSIONS,
} from '@/lib/permissions'
import { z } from 'zod'

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DEACTIVATED'] as const

const updateSchema = z.object({
  // AUDIT P0-5: constrain to known roles/statuses rather than any string.
  role: z.enum(Object.keys(ROLE_HIERARCHY) as [string, ...string[]]).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  permissions: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = updateSchema.parse(await req.json())

    const user = await prisma.user.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // AUDIT P0-5: authorization ceiling checks — a PM could previously send
    // {"role":"SUPER_ADMIN"} and self-promote. All role/permission/status changes
    // are now validated against the assigner's own level and permission set.
    const assignerRole = session.user.role as string
    const assignerLevel = ROLE_HIERARCHY[assignerRole] ?? 99
    const isSelf = params.id === session.user.id

    // Cannot change your own role or status (prevents self-escalation / self-lockout).
    if (isSelf && (body.role || body.status)) {
      return NextResponse.json(
        { error: 'You cannot change your own role or status' },
        { status: 403 },
      )
    }

    // Cannot modify a user at your level or above (only strictly-less-privileged users).
    const targetLevel = ROLE_HIERARCHY[user.role] ?? 99
    if (!isSelf && targetLevel <= assignerLevel && !isAdmin(assignerRole)) {
      return NextResponse.json(
        { error: 'You cannot modify a user at or above your role level' },
        { status: 403 },
      )
    }

    // New role must be assignable by the caller (enforces hierarchy + SENIOR_PM rule).
    if (body.role && !canAssignRole(assignerRole, body.role)) {
      return NextResponse.json(
        { error: `You are not permitted to assign the role ${body.role}` },
        { status: 403 },
      )
    }

    // Cannot grant permissions the assigner does not themselves hold.
    if (body.permissions) {
      const assignerPerms = isAdmin(assignerRole)
        ? (ALL_PERMISSIONS as readonly string[])
        : ((session.user as any).permissions ?? [])
      const overreach = body.permissions.filter((p) => !assignerPerms.includes(p))
      if (overreach.length > 0) {
        return NextResponse.json(
          { error: `You cannot grant permissions you do not hold: ${overreach.join(', ')}` },
          { status: 403 },
        )
      }
    }

    // Update user fields
    const updateData: any = {}
    if (body.role) updateData.role = body.role
    if (body.status) updateData.status = body.status
    if (body.permissions) updateData.permissionsJson = JSON.stringify(body.permissions)

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id: params.id }, data: updateData })
    }

    // Update product access if provided
    if (body.productIds) {
      // AUDIT P0-9: only grant access to products that belong to the caller's org,
      // preventing cross-tenant user-to-product assignment.
      const orgProducts = await prisma.product.findMany({
        where: { id: { in: body.productIds }, organizationId: session.user.organizationId },
        select: { id: true },
      })
      const validProductIds = orgProducts.map((p) => p.id)
      await prisma.userProductAccess.deleteMany({ where: { userId: params.id } })
      if (validProductIds.length > 0) {
        await (prisma.userProductAccess.createMany as any)({
          data: validProductIds.map((pid) => ({ userId: params.id, productId: pid })),
          skipDuplicates: true,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Don't allow self-deletion
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: params.id },
      data: { status: 'DEACTIVATED' },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
