import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'

function computeHealth(c: {
  description: string
  managedSources: Array<{ sourceType: string; status: string; lastSuccessAt: Date | null; isActive: boolean }>
  features: Array<{ matchConfidence: number; sourceEvidence: Array<{ id: string }> }>
  reports: Array<{ status: string; confidenceOverall: number | null }>
  _count: { features: number; keyUpdates: number }
}) {
  const { managedSources, features, reports } = c

  const sections = {
    description: !!c.description?.trim(),
    features: features.length > 0,
    sources: managedSources.length > 0,
    keyUpdates: c._count.keyUpdates > 0,
    report: reports.length > 0 && reports[0]?.status === 'READY',
  }
  const completeness = Math.round(
    (Object.values(sections).filter(Boolean).length / Object.keys(sections).length) * 100
  )

  const featuresWithConf = features.filter((f) => f.matchConfidence > 0)
  const confidenceScore = featuresWithConf.length > 0
    ? Math.round(featuresWithConf.reduce((s, f) => s + f.matchConfidence, 0) / featuresWithConf.length * 100)
    : 0

  const evidenceBackedCount = features.filter((f) => f.sourceEvidence.length > 0).length
  const sourceCoverage = Array.from(new Set(managedSources.map((s) => s.sourceType)))

  const now = Date.now()
  const failingCount = managedSources.filter((s) => s.status === 'FAILED' || s.status === 'BLOCKED').length
  const staleCount = managedSources.filter((s) => {
    if (s.status === 'FAILED' || s.status === 'BLOCKED') return false
    if (!s.lastSuccessAt) return s.isActive
    return (now - new Date(s.lastSuccessAt).getTime()) / 86_400_000 > 14
  }).length

  const warnings: string[] = []
  if (failingCount > 0) warnings.push(`${failingCount} source${failingCount > 1 ? 's' : ''} failing`)
  if (staleCount > 0) warnings.push(`${staleCount} source${staleCount > 1 ? 's' : ''} stale`)
  if (!c.description?.trim()) warnings.push('Description missing')
  if (features.length === 0) warnings.push('No features extracted')
  if (reports.length === 0) warnings.push('No report generated')

  const successDates = managedSources.map((s) => s.lastSuccessAt).filter(Boolean) as Date[]
  const lastSuccessfulCrawl = successDates.length > 0
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

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = getProductIdFromRequest(req)
    const raw = await prisma.competitor.findMany({
      where: { organizationId: orgId, ...(productId ? { OR: [{ productId }, { productId: null }] } : {}) },
      include: {
        _count: { select: { features: true, keyUpdates: true, managedSources: true } },
        features: {
          select: {
            category: true,
            matchConfidence: true,
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

    const competitors = raw.map(({ features, managedSources, reports, ...c }) => ({
      ...c,
      categories: Array.from(new Set(features.map((f) => f.category).filter(Boolean))),
      health: computeHealth({ ...c, features, managedSources, reports }),
    }))

    return NextResponse.json(competitors)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  website: z.string().default(''),
  description: z.string().default(''),
  monitoringEnabled: z.boolean().default(true),
  refreshFrequencyDays: z.number().default(15),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const raw = await req.json()
    const body = createSchema.parse(raw)
    // Use productId from body, or fall back to selected product cookie
    const productId = raw.productId || getProductIdFromRequest(req)
    const competitor = await prisma.competitor.create({ data: { ...body, organizationId: orgId, ...(productId ? { productId } : {}) } })
    return NextResponse.json(competitor, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
