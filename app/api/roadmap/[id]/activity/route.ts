import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const activities = await prisma.roadmapActivity.findMany({
      where: { roadmapItemId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(activities)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { eventType, actorName, metadataJson } = await req.json()
    const activity = await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: params.id,
        eventType,
        actorName: actorName ?? 'User',
        metadataJson: metadataJson ?? '{}',
      },
    })
    return NextResponse.json(activity, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
