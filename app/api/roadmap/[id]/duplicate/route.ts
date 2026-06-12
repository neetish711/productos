import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const original = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const max = await prisma.roadmapItem.aggregate({
      where: { productId: original.productId },
      _max: { sortOrder: true },
    })

    const dup = await prisma.roadmapItem.create({
      data: {
        productId: original.productId,
        title: `Copy of ${original.title}`,
        description: original.description,
        category: original.category,
        status: 'PROPOSED',
        riceReach: original.riceReach,
        riceImpact: original.riceImpact,
        riceConfidence: original.riceConfidence,
        riceEffort: original.riceEffort,
        priorityScore: original.priorityScore,
        targetQuarter: original.targetQuarter,
        notes: original.notes,
        sourceType: 'MANUAL',
        duplicatedFromId: original.id,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        specStatus: 'NO_SPEC',
      },
    })

    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: dup.id,
        eventType: 'item_created',
        actorName: 'User',
        metadataJson: JSON.stringify({ duplicatedFrom: original.id, originalTitle: original.title }),
      },
    })

    return NextResponse.json(dup, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
