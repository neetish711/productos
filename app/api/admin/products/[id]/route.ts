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
      status: z.string().optional(),
    }).parse(await req.json())

    const product = await prisma.product.update({
      where: { id: params.id },
      data: body,
    })

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

    await prisma.product.update({
      where: { id: params.id },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
