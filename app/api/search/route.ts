import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json([])

    const products = await prisma.product.findMany({ where: { organizationId: orgId } })
    const productIds = products.map((p) => p.id)

    const [features, competitors, roadmapItems, specs, accounts] = await Promise.all([
      prisma.ourFeature.findMany({ where: { productId: { in: productIds }, OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } as any, take: 5 }),
      prisma.competitor.findMany({ where: { organizationId: orgId, name: { contains: q, mode: 'insensitive' } } as any, take: 5 }),
      prisma.roadmapItem.findMany({ where: { productId: { in: productIds }, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } as any, take: 5 }),
      prisma.spec.findMany({ where: { roadmapItem: { productId: { in: productIds } }, title: { contains: q, mode: 'insensitive' } } as any, take: 5 }),
      prisma.account.findMany({ where: { organizationId: orgId, name: { contains: q, mode: 'insensitive' } } as any, take: 5 }),
    ])

    const results = [
      ...features.map((r) => ({ type: 'feature', id: r.id, title: r.name, subtitle: r.category, href: '/features' })),
      ...competitors.map((r) => ({ type: 'competitor', id: r.id, title: r.name, subtitle: r.website, href: `/competitors/${r.id}` })),
      ...roadmapItems.map((r) => ({ type: 'roadmap', id: r.id, title: r.title, subtitle: r.status, href: '/roadmap' })),
      ...specs.map((r) => ({ type: 'spec', id: r.id, title: r.title, subtitle: `v${r.version}`, href: `/specs/${r.id}` })),
      ...accounts.map((r) => ({ type: 'account', id: r.id, title: r.name, subtitle: r.healthStatus, href: `/accounts/${r.id}` })),
    ]

    return NextResponse.json(results)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}
