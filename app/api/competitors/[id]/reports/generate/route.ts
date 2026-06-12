import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { generateCompetitorReport } from '@/lib/competitor-intelligence/report-generator'

// POST /api/competitors/[id]/reports/generate
export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check if already in progress
    const inProgress = await prisma.competitorReport.findFirst({
      where: { competitorId: params.id, organizationId: orgId, status: 'IN_PROGRESS' },
    })
    if (inProgress) {
      return NextResponse.json(
        { error: 'A report is already being generated', reportId: inProgress.id },
        { status: 409 }
      )
    }

    // Fire-and-forget generation
    generateCompetitorReport(params.id, orgId).catch((err) => {
      console.error('[reports/generate] background error:', err)
    })

    // Return the pending report ID — client polls /reports to check status
    const pending = await prisma.competitorReport.findFirst({
      where: { competitorId: params.id, organizationId: orgId, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ok: true, status: 'IN_PROGRESS', reportId: pending?.id })
  } catch (e) {
    console.error('[reports/generate]', e)
    return NextResponse.json({ error: 'Failed to start report generation' }, { status: 500 })
  }
}
