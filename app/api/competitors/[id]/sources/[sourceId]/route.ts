import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  url: z.string().url('Must be a valid URL').optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  sourceType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

async function getOwnedSource(sourceId: string, competitorId: string, orgId: string) {
  const source = await prisma.sourceEvidence.findFirst({
    where: { id: sourceId },
    include: { competitorFeature: true },
  })
  if (!source) return null
  if (source.competitorFeature.competitorId !== competitorId) return null

  // Verify the competitor belongs to the org
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, organizationId: orgId },
  })
  if (!competitor) return null
  return source
}

// PUT /api/competitors/[id]/sources/[sourceId]
export async function PUT(req: Request, { params }: { params: { id: string; sourceId: string } }) {
  try {
    const orgId = await getOrgId()
    const source = await getOwnedSource(params.sourceId, params.id, orgId)
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = updateSchema.parse(await req.json())
    const updated = await prisma.sourceEvidence.update({
      where: { id: params.sourceId },
      data: body,
    })
    return NextResponse.json({
      ...updated,
      featureId: source.competitorFeature.id,
      featureName: source.competitorFeature.name,
    })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// DELETE /api/competitors/[id]/sources/[sourceId]
export async function DELETE(_: Request, { params }: { params: { id: string; sourceId: string } }) {
  try {
    const orgId = await getOrgId()
    const source = await getOwnedSource(params.sourceId, params.id, orgId)
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.sourceEvidence.delete({ where: { id: params.sourceId } })
    return new NextResponse(null, { status: 204 })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
