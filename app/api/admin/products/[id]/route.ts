import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'
import { z } from 'zod'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
    }).parse(await req.json())

    // AUDIT P0-9: scope the update to the caller's org so an admin in org A
    // cannot rename another tenant's product by guessing its id.
    const result = await prisma.product.updateMany({
      where: { id: params.id, organizationId: session.user.organizationId },
      data: body,
    })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const product = await prisma.product.findUnique({ where: { id: params.id } })
    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // AUDIT P0-9: org-scoped archive so a tenant can't archive another tenant's product.
    const result = await prisma.product.updateMany({
      where: { id: params.id, organizationId: session.user.organizationId },
      data: { status: 'ARCHIVED' },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
