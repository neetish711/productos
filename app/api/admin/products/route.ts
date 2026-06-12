import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'
import { z } from 'zod'

export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const products = await prisma.product.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        _count: { select: { roadmapItems: true, ourFeatures: true, userAccess: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = z.object({
      name: z.string().min(1),
      description: z.string().nullish().transform((v) => v ?? ''),
    }).parse(await req.json())

    const product = await prisma.product.create({
      data: {
        ...body,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
      },
    })

    // Grant access to the creator
    await prisma.userProductAccess.create({
      data: { userId: session.user.id, productId: product.id },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
