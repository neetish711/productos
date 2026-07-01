import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { crawlUrl, isCrawl4AIAvailable, truncateForLLM } from '@/lib/crawler/crawl4ai'

// POST /api/competitors/[id]/managed-sources/[sourceId]/crawl
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

    const now = new Date()

    // Check if Crawl4AI is available
    const crawlerAvailable = await isCrawl4AIAvailable()

    if (!crawlerAvailable) {
      // AUDIT S2-3: no content was fetched. Do NOT mark success (no lastSuccessAt,
      // no ACTIVE/OK, no fabricated freshness) — record a distinct SIMULATED state
      // and return a non-success response so the UI shows the crawler is offline.
      const updated = await prisma.competitorSource.update({
        where: { id: params.sourceId },
        data: {
          lastCrawledAt: now,
          crawlHealthStatus: 'SIMULATED',
        },
      })
      return NextResponse.json({
        ok: false,
        simulated: true,
        source: updated,
        crawlerUsed: 'simulated',
        message: 'Crawl4AI is not available — no content was fetched. Configure CRAWL4AI_URL to enable real crawling.',
      }, { status: 503 })
    }

    // Real crawl via Crawl4AI
    const result = await crawlUrl({
      url: source.url,
      timeout: 30000,
    })

    if (!result.success) {
      await prisma.competitorSource.update({
        where: { id: params.sourceId },
        data: {
          status: 'FAILED',
          lastCrawledAt: now,
          crawlHealthStatus: result.error || 'Crawl failed',
        },
      })
      return NextResponse.json({
        ok: false,
        error: result.error,
        crawlerUsed: 'crawl4ai',
      }, { status: 502 })
    }

    // Success — update source with crawl results
    const updated = await prisma.competitorSource.update({
      where: { id: params.sourceId },
      data: {
        status: 'ACTIVE',
        lastCrawledAt: now,
        lastSuccessAt: now,
        lastChangeAt: now,
        freshnessScore: 1.0,
        crawlHealthStatus: 'OK',
      },
    })

    return NextResponse.json({
      ok: true,
      source: updated,
      crawlerUsed: 'crawl4ai',
      crawl: {
        title: result.title,
        wordCount: result.wordCount,
        contentPreview: result.markdown.slice(0, 500),
      },
    })
  } catch (err) {
    console.error('Crawl error:', err)
    return NextResponse.json({ error: 'Error triggering crawl' }, { status: 500 })
  }
}
