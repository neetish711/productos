import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// AUDIT P0-9: strict whitelist — never spread the raw request body into Prisma,
// which previously allowed reassigning organizationId/productId (tenant move).
const updateCompetitorSchema = z.object({
  name: z.string().min(1).optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  monitoringEnabled: z.boolean().optional(),
  refreshFrequencyDays: z.number().optional(),
}).strict()

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
      include: {
        features: { include: { sourceEvidence: true }, orderBy: { updatedAt: 'desc' } },
        keyUpdates: { orderBy: { detectedAt: 'desc' }, take: 20 },
        managedSources: { orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }] },
        reports: {
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, generatedAt: true, executiveSummary: true, confidenceOverall: true, evidenceCount: true, sourceCount: true },
        },
        _count: { select: { features: true, managedSources: true } },
      },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(competitor)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.competitor.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = updateCompetitorSchema.parse(await req.json())
    const updated = await prisma.competitor.update({ where: { id: params.id }, data: body })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.competitor.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.competitor.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
