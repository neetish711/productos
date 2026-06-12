import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// POST /api/competitors/[id]/managed-sources/[sourceId]/crawl
// Simulates triggering a crawl for a single source
export async function POST(
  _: Request,
  { params }: { params: { id: string; sourceId: string } }
) {
  try {
    const orgId = await getOrgId()
    const source = await prisma.competitorSource.findFirst({
      where: {
        id: params.sourceId,
        competitorId: params.id,
        competitor: { organizationId: orgId },
      },
    })
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Simulate crawl: update status and timestamps
    const now = new Date()
    const updated = await prisma.competitorSource.update({
      where: { id: params.sourceId },
      data: {
        status: 'ACTIVE',
        lastCrawledAt: now,
        lastSuccessAt: now,
        freshnessScore: 0.9 + Math.random() * 0.1,
        crawlHealthStatus: 'OK',
      },
    })

    return NextResponse.json({ ok: true, source: updated })
  } catch { return NextResponse.json({ error: 'Error triggering crawl' }, { status: 500 }) }
}
