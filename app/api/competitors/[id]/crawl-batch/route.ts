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
        // Simulated crawl
        await prisma.competitorSource.update({
          where: { id: source.id },
          data: {
            status: 'ACTIVE',
            lastCrawledAt: now,
            lastSuccessAt: now,
            freshnessScore: 0.5,
            crawlHealthStatus: 'SIMULATED',
          },
        })
        results.push({ sourceId: source.id, url: source.url, success: true, title: 'Simulated' })
      }
    }

    // Update competitor status
    await prisma.competitor.update({
      where: { id: params.id },
      data: { lastRefreshAt: new Date(), setupStatus: 'ACTIVE' },
    })

    const successCount = results.filter((r) => r.success).length
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
