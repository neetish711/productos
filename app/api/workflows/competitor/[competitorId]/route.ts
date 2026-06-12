import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { preflightCheck, getInFlightRun } from '@/lib/workflow-engine/engine'

// GET — status, preflight, and recent runs for a competitor
export async function GET(req: Request, { params }: { params: { competitorId: string } }) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.organizationId
  const competitorId = params.competitorId

  // Verify competitor belongs to org
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, organizationId: orgId },
    select: {
      id: true,
      name: true,
      lastRefreshAt: true,
      managedSources: { where: { isActive: true }, select: { id: true, status: true, lastSuccessAt: true, lastCrawledAt: true } },
      features: { select: { id: true, sourceEvidence: { select: { id: true } } } },
      reports: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } },
      battleCards: { select: { id: true, updatedAt: true } },
    },
  })

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Preflight checks
  const deepAnalysisPreflight = await preflightCheck('COMPETITOR_DEEP_ANALYSIS', { competitorId })
  const refreshPreflight = await preflightCheck('COMPETITOR_REFRESH', { competitorId })

  // In-flight runs
  const deepAnalysisInFlight = await getInFlightRun('COMPETITOR_DEEP_ANALYSIS', orgId, competitorId)
  const refreshInFlight = await getInFlightRun('COMPETITOR_REFRESH', orgId, competitorId)

  // Recent runs (last 10)
  const recentRuns = await prisma.workflowRun.findMany({
    where: {
      organizationId: orgId,
      inputParamsJson: { contains: competitorId },
    },
    include: { steps: { orderBy: { stepIndex: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Stale sources
  const now = Date.now()
  const staleSources = competitor.managedSources.filter((s) => {
    if (!s.lastSuccessAt) return s.status !== 'FAILED'
    return (now - new Date(s.lastSuccessAt).getTime()) / 86_400_000 > 14
  })

  // Compute "next step" guidance
  const guidance = computeGuidance(competitor, staleSources, deepAnalysisPreflight, deepAnalysisInFlight, recentRuns)

  return NextResponse.json({
    competitorId,
    setup: {
      sources: competitor.managedSources.length,
      features: competitor.features.length,
      evidenceBacked: competitor.features.filter((f) => f.sourceEvidence.length > 0).length,
      staleSources: staleSources.length,
      failedSources: competitor.managedSources.filter((s) => s.status === 'FAILED').length,
      hasReport: (competitor.reports[0]?.status === 'READY'),
      hasBattleCard: competitor.battleCards.length > 0,
      lastRefresh: competitor.lastRefreshAt,
    },
    preflight: {
      deepAnalysis: deepAnalysisPreflight,
      refresh: refreshPreflight,
    },
    inFlight: {
      deepAnalysis: deepAnalysisInFlight,
      refresh: refreshInFlight,
    },
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      type: r.workflowType,
      status: r.status,
      totalTokens: r.totalTokens,
      estimatedCost: r.estimatedCost,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      steps: r.steps.map((s) => ({
        name: s.stepName,
        status: s.status,
        tokensUsed: s.tokensUsed,
      })),
    })),
    guidance,
  })
}

function computeGuidance(
  competitor: any,
  staleSources: any[],
  preflight: { ok: boolean; errors: string[] },
  inFlight: any | null,
  recentRuns: any[],
): { priority: number; message: string; action: string; actionLabel: string } {
  // Priority 1: Setup incomplete
  if (!preflight.ok) {
    const hasSources = competitor.managedSources.length > 0
    const hasFeatures = competitor.features.length > 0
    if (!hasSources && !hasFeatures) {
      return { priority: 1, message: `Add sources and features for ${competitor.name}`, action: 'setup', actionLabel: 'Add Sources' }
    }
    if (!hasSources) {
      return { priority: 1, message: `Add sources for ${competitor.name}`, action: 'add-sources', actionLabel: 'Add Sources' }
    }
    return { priority: 1, message: `Add features for ${competitor.name}`, action: 'add-features', actionLabel: 'Add Features' }
  }

  // Priority 2: Stale/failed sources
  if (staleSources.length > 0) {
    return { priority: 2, message: `${staleSources.length} source${staleSources.length > 1 ? 's' : ''} stale or not crawled`, action: 'review-sources', actionLabel: 'Review Sources' }
  }

  // Priority 3: Currently running
  if (inFlight) {
    return { priority: 3, message: 'Deep Analysis is running...', action: 'view-run', actionLabel: 'View Progress' }
  }

  // Priority 4: Failed run
  const lastRun = recentRuns[0]
  if (lastRun?.status === 'FAILED') {
    const failedStep = lastRun.steps.find((s: any) => s.status === 'FAILED')
    return { priority: 4, message: `Last run failed at step "${failedStep?.name || 'unknown'}"`, action: 'retry', actionLabel: 'Retry' }
  }

  // Priority 5: No recent run
  const hasRecentRun = lastRun && (Date.now() - new Date(lastRun.startedAt).getTime()) < 7 * 86_400_000
  if (!hasRecentRun) {
    return { priority: 5, message: 'No analysis in the last 7 days', action: 'run-deep', actionLabel: 'Run Deep Analysis' }
  }

  // Priority 6: Report ready but battlecard stale
  const hasReport = competitor.reports[0]?.status === 'READY'
  const bc = competitor.battleCards[0]
  if (hasReport && bc) {
    const reportDate = new Date(competitor.reports[0].createdAt)
    const bcDate = new Date(bc.updatedAt)
    if (reportDate > bcDate) {
      return { priority: 6, message: 'Battle card is outdated — a newer report is available', action: 'refresh-battlecard', actionLabel: 'Refresh Battle Card' }
    }
  }

  // Priority 7: All green
  return { priority: 7, message: 'Up to date', action: 'none', actionLabel: '' }
}
