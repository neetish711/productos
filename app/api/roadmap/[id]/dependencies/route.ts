import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const VALID_TYPES = ['DEPENDS_ON', 'BLOCKED_BY', 'RELATED_TO', 'PARENT_EPIC', 'CHILD_ENHANCEMENT']

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [from, to] = await Promise.all([
      prisma.roadmapDependency.findMany({
        where: { fromItemId: params.id },
        include: { toItem: { select: { id: true, title: true, status: true, category: true } } },
      }),
      prisma.roadmapDependency.findMany({
        where: { toItemId: params.id },
        include: { fromItem: { select: { id: true, title: true, status: true, category: true } } },
      }),
    ])

    return NextResponse.json({ outgoing: from, incoming: to })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

const createSchema = z.object({
  toItemId: z.string(),
  relationshipType: z.enum(['DEPENDS_ON', 'BLOCKED_BY', 'RELATED_TO', 'PARENT_EPIC', 'CHILD_ENHANCEMENT']),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = createSchema.parse(await req.json())
    if (body.toItemId === params.id) {
      return NextResponse.json({ error: 'Cannot create self-dependency' }, { status: 400 })
    }

    const dep = await prisma.roadmapDependency.create({
      data: { fromItemId: params.id, toItemId: body.toItemId, relationshipType: body.relationshipType },
      include: { toItem: { select: { id: true, title: true, status: true } } },
    })

    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: params.id,
        eventType: 'dependency_added',
        actorName: 'User',
        metadataJson: JSON.stringify({ toItemId: body.toItemId, relationshipType: body.relationshipType }),
      },
    })

    return NextResponse.json(dep, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const { depId } = await req.json()
    const dep = await prisma.roadmapDependency.findFirst({
      where: { id: depId, fromItemId: params.id },
    })
    if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.roadmapDependency.delete({ where: { id: depId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
