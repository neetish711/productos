import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { crawlUrl, isCrawl4AIAvailable } from '@/lib/crawler/crawl4ai'

// POST /api/competitors/[id]/crawl-batch
// Crawl all approved (ACTIVE) sources for a competitor
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const body = await req.json().catch(() => ({}))
    const sourceIds: string[] | undefined = body.sourceIds

    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Get sources to crawl
    const where: any = {
      competitorId: params.id,
      competitor: { organizationId: orgId },
      isActive: true,
    }
    if (sourceIds?.length) where.id = { in: sourceIds }

    const sources = await prisma.competitorSource.findMany({ where })
    if (sources.length === 0) {
      return NextResponse.json({ error: 'No sources to crawl' }, { status: 400 })
    }

    const crawlerAvailable = await isCrawl4AIAvailable()
    const results: Array<{ sourceId: string; url: string; success: boolean; title?: string; wordCount?: number; error?: string }> = []

    for (const source of sources) {
      const now = new Date()
      if (crawlerAvailable) {
        const crawled = await crawlUrl({ url: source.url, timeout: 30000 })
        if (crawled.success) {
          await prisma.competitorSource.update({
            where: { id: source.id },
            data: {
              status: 'ACTIVE',
              lastCrawledAt: now,
              lastSuccessAt: now,
              lastChangeAt: now,
              freshnessScore: 1.0,
              crawlHealthStatus: 'OK',
            },
          })
          results.push({ sourceId: source.id, url: source.url, success: true, title: crawled.title, wordCount: crawled.wordCount })
        } else {
          await prisma.competitorSource.update({
            where: { id: source.id },
            data: { status: 'FAILED', lastCrawledAt: now, crawlHealthStatus: crawled.error || 'Crawl failed' },
          })
          results.push({ sourceId: source.id, url: source.url, success: false, error: crawled.error })
        }
      } else {
        // AUDIT S2-3: crawler offline — record SIMULATED but do NOT mark success
        // (no lastSuccessAt, no ACTIVE/OK, no fabricated freshness).
        await prisma.competitorSource.update({
          where: { id: source.id },
          data: { lastCrawledAt: now, crawlHealthStatus: 'SIMULATED' },
        })
        results.push({ sourceId: source.id, url: source.url, success: false, error: 'Crawl4AI unavailable — skipped (no content fetched)' })
      }
    }

    const successCount = results.filter((r) => r.success).length

    // AUDIT S2-3: only advance the competitor to ACTIVE if something real was crawled.
    await prisma.competitor.update({
      where: { id: params.id },
      data: { lastRefreshAt: new Date(), ...(successCount > 0 ? { setupStatus: 'ACTIVE' } : {}) },
    })
    return NextResponse.json({
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      crawlerUsed: crawlerAvailable ? 'crawl4ai' : 'simulated',
      results,
    })
  } catch (err) {
    console.error('Batch crawl error:', err)
    return NextResponse.json({ error: 'Batch crawl failed' }, { status: 500 })
  }
}
