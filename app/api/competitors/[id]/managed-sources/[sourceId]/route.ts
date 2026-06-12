import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  url: z.string().url().optional(),
  sourceType: z.string().optional(),
  label: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  crawlFrequency: z.string().optional(),
  crawlDepth: z.number().int().min(1).max(10).optional(),
  includePaths: z.string().optional(),
  excludePaths: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  recrawlStrategy: z.string().optional(),
  changeDetectionTypes: z.string().optional(),
  contentTypes: z.string().optional(),
}).strict()

async function verifyOwnership(sourceId: string, competitorId: string, orgId: string) {
  return prisma.competitorSource.findFirst({
    where: {
      id: sourceId,
      competitorId,
      competitor: { organizationId: orgId },
    },
  })
}

// GET /api/competitors/[id]/managed-sources/[sourceId]
export async function GET(
  _: Request,
  { params }: { params: { id: string; sourceId: string } }
) {
  try {
    const orgId = await getOrgId()
    const source = await verifyOwnership(params.sourceId, params.id, orgId)
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(source)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

// PUT /api/competitors/[id]/managed-sources/[sourceId]
export async function PUT(
  req: Request,
  { params }: { params: { id: string; sourceId: string } }
) {
  try {
    const orgId = await getOrgId()
    const source = await verifyOwnership(params.sourceId, params.id, orgId)
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = updateSchema.parse(await req.json())
    const updated = await prisma.competitorSource.update({
      where: { id: params.sourceId },
      data: body,
    })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error updating source' }, { status: 500 })
  }
}

// DELETE /api/competitors/[id]/managed-sources/[sourceId]
export async function DELETE(
  _: Request,
  { params }: { params: { id: string; sourceId: string } }
) {
  try {
    const orgId = await getOrgId()
    const source = await verifyOwnership(params.sourceId, params.id, orgId)
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.competitorSource.delete({ where: { id: params.sourceId } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Error deleting source' }, { status: 500 }) }
}
