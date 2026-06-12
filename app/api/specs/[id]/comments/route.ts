import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  specVersionId: z.string(),
  anchorStart: z.number().default(0),
  anchorEnd: z.number().default(0),
  anchorText: z.string().default(''),
  sectionName: z.string().default(''),
  issueType: z.enum(['incorrect','unclear','incomplete','too_generic','rewrite_needed','missing_edge_case','missing_acceptance_criteria','business_issue','technical_clarification']).default('unclear'),
  severity: z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),
  body: z.string().min(1),
  includeInRegeneration: z.boolean().default(true),
})

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const { searchParams } = new URL(req.url)
    const versionId = searchParams.get('versionId')

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const where = versionId ? { specVersionId: versionId } : {
      specVersion: { specId: params.id },
    }
    const comments = await prisma.pRDComment.findMany({
      where,
      orderBy: { anchorStart: 'asc' },
    })
    return NextResponse.json(comments)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = createSchema.parse(await req.json())

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const version = await prisma.specVersion.findFirst({
      where: { id: body.specVersionId, specId: params.id },
    })
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    const comment = await prisma.pRDComment.create({
      data: {
        ...body,
        createdByUserId: session.user.id,
        createdByName: session.user.name,
      },
    })

    if (spec.roadmapItemId) {
      await prisma.roadmapActivity.create({
        data: { roadmapItemId: spec.roadmapItemId, specId: params.id, eventType: 'comment_added', actorName: session.user.name, metadataJson: JSON.stringify({ issueType: body.issueType, sectionName: body.sectionName }) },
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
