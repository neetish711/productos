import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  role: z.string().optional(),
  status: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = updateSchema.parse(await req.json())

    const user = await prisma.user.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

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
      await prisma.userProductAccess.deleteMany({ where: { userId: params.id } })
      if (body.productIds.length > 0) {
        await (prisma.userProductAccess.createMany as any)({
          data: body.productIds.map((pid) => ({ userId: params.id, productId: pid })),
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
    if (!session?.user || !isAdmin(session.user.role)) {
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
