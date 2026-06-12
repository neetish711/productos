import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { CompetitorsClient } from './_client'

function computeHealth(competitor: {
  description: string
  managedSources: Array<{ sourceType: string; status: string; lastSuccessAt: Date | null; isActive: boolean; crawlHealthStatus: string | null }>
  features: Array<{ category: string; matchConfidence: number; sourceEvidence: Array<{ id: string }> }>
  reports: Array<{ status: string; confidenceOverall: number | null }>
  _count: { features: number; keyUpdates: number }
}) {
  const { managedSources, features, reports } = competitor

  // Completeness: which key sections are populated
  const sections = {
    description: !!competitor.description?.trim(),
    features: features.length > 0,
    sources: managedSources.length > 0,
    keyUpdates: competitor._count.keyUpdates > 0,
    report: reports.length > 0 && reports[0]?.status === 'READY',
  }
  const completeness = Math.round(
    (Object.values(sections).filter(Boolean).length / Object.keys(sections).length) * 100
  )

  // Confidence: avg matchConfidence across features (0–1 → 0–100)
  const featuresWithConf = features.filter((f) => f.matchConfidence > 0)
  const confidenceScore =
    featuresWithConf.length > 0
      ? Math.round(
          (featuresWithConf.reduce((s, f) => s + f.matchConfidence, 0) / featuresWithConf.length) * 100
        )
      : 0

  // Evidence-backed features
  const evidenceBackedCount = features.filter((f) => f.sourceEvidence.length > 0).length

  // Source coverage by type
  const sourceCoverage = Array.from(new Set(managedSources.map((s) => s.sourceType)))

  // Source health warnings
  const now = Date.now()
  const failingCount = managedSources.filter(
    (s) => s.status === 'FAILED' || s.status === 'BLOCKED'
  ).length
  const staleCount = managedSources.filter((s) => {
    if (s.status === 'FAILED' || s.status === 'BLOCKED') return false
    if (!s.lastSuccessAt) return s.isActive
    return (now - new Date(s.lastSuccessAt).getTime()) / 86_400_000 > 14
  }).length

  const warnings: string[] = []
  if (failingCount > 0) warnings.push(`${failingCount} source${failingCount > 1 ? 's' : ''} failing`)
  if (staleCount > 0) warnings.push(`${staleCount} source${staleCount > 1 ? 's' : ''} stale`)
  if (!competitor.description?.trim()) warnings.push('Description missing')
  if (features.length === 0) warnings.push('No features extracted')
  if (reports.length === 0) warnings.push('No report generated')

  // Latest successful crawl across all sources
  const successDates = managedSources.map((s) => s.lastSuccessAt).filter(Boolean) as Date[]
  const lastSuccessfulCrawl =
    successDates.length > 0
      ? new Date(Math.max(...successDates.map((d) => new Date(d).getTime())))
      : null

  return {
    completeness,
    confidenceScore,
    evidenceBackedCount,
    sourceCoverage,
    sourceWarnings: failingCount + staleCount,
    activeSourceCount: managedSources.filter((s) => s.isActive).length,
    lastSuccessfulCrawl,
    warnings,
  }
}

export default async function CompetitorsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const raw = await prisma.competitor.findMany({
    where: { organizationId: orgId, OR: [{ productId }, { productId: null }] },
    include: {
      _count: { select: { features: true, keyUpdates: true, managedSources: true } },
      features: {
        select: {
          category: true,
          matchConfidence: true,
          enrichmentStatus: true,
          sourceEvidence: { select: { id: true } },
        },
      },
      managedSources: {
        select: {
          id: true,
          sourceType: true,
          status: true,
          isActive: true,
          lastSuccessAt: true,
          crawlHealthStatus: true,
        },
      },
      reports: {
        select: { id: true, status: true, confidenceOverall: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  })

  const competitors = raw.map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    description: c.description,
    logoUrl: c.logoUrl,
    monitoringEnabled: c.monitoringEnabled,
    setupStatus: c.setupStatus,
    lastRefreshAt: c.lastRefreshAt,
    reportStatus: c.reportStatus,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    _count: c._count,
    categories: Array.from(new Set(c.features.map((f) => f.category).filter(Boolean))),
    health: computeHealth(c),
  }))

  return <CompetitorsClient initialCompetitors={competitors as any} />
}
