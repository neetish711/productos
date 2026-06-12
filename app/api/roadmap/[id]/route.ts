import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { computeRICEScore } from '@/lib/utils'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
      include: {
        spec: { select: { id: true, version: true, lifecycleState: true, templateType: true } },
        dependenciesFrom: { include: { toItem: { select: { id: true, title: true, status: true, category: true } } } },
        dependenciesTo: { include: { fromItem: { select: { id: true, title: true, status: true, category: true } } } },
      },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(item)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.roadmapItem.findFirst({ where: { id: params.id, product: { organizationId: orgId } } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    // Strip relation fields that can't be set directly
    const { id: _id, productId: _pid, spec: _spec, activities: _act, dependenciesFrom: _df, dependenciesTo: _dt, createdAt: _ca, updatedAt: _ua, ...safeBody } = body
    const reach = safeBody.riceReach ?? existing.riceReach
    const impact = safeBody.riceImpact ?? existing.riceImpact
    const confidence = safeBody.riceConfidence ?? existing.riceConfidence
    const effort = safeBody.riceEffort ?? existing.riceEffort
    const priorityScore = computeRICEScore(reach, impact, confidence, effort)
    const updated = await prisma.roadmapItem.update({ where: { id: params.id }, data: { ...safeBody, priorityScore } })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.roadmapItem.findFirst({ where: { id: params.id, product: { organizationId: orgId } } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.roadmapItem.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
