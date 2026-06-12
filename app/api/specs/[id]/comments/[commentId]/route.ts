import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  body: z.string().optional(),
  issueType: z.string().optional(),
  severity: z.string().optional(),
  status: z.enum(['OPEN','RESOLVED']).optional(),
  includeInRegeneration: z.boolean().optional(),
  actionType: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string; commentId: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = updateSchema.parse(await req.json())

    const comment = await prisma.pRDComment.findFirst({
      where: { id: params.commentId, specVersion: { specId: params.id } },
    })
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.pRDComment.update({
      where: { id: params.commentId },
      data: body,
    })

    if (body.status === 'RESOLVED') {
      const spec = await prisma.spec.findFirst({ where: { id: params.id }, select: { roadmapItemId: true } })
      if (spec?.roadmapItemId) {
        await prisma.roadmapActivity.create({
          data: { roadmapItemId: spec.roadmapItemId, specId: params.id, eventType: 'comment_resolved', actorName: session.user.name as any, metadataJson: JSON.stringify({ commentId: params.commentId }) },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string; commentId: string } }) {
  try {
    const comment = await prisma.pRDComment.findFirst({
      where: { id: params.commentId, specVersion: { specId: params.id } },
    })
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.pRDComment.delete({ where: { id: params.commentId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
