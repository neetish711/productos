import { prisma } from '@/lib/db'
import { generateCompetitorReport } from '@/lib/competitor-intelligence/report-generator'
import { crawlUrl, isCrawl4AIAvailable, truncateForLLM } from '@/lib/crawler/crawl4ai'
import { notifyGoogleChat } from '@/lib/integrations/google-chat'
import type { WorkflowDefinition, WorkflowStepDefinition } from '@/types/workflow'

// ─── Step 1: Source Audit ─────────────────────────────────────────────────────

const sourceAudit: WorkflowStepDefinition = {
  name: 'SOURCE_AUDIT',
  required: true,
  async execute({ ctx }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) throw new Error('competitorId required in params')

    const sources = await prisma.competitorSource.findMany({
      where: { competitorId, competitor: { organizationId: ctx.orgId } },
    })

    const stale = sources.filter((s) => {
      if (!s.lastCrawledAt) return true
      const daysSince = (Date.now() - new Date(s.lastCrawledAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSince > 30
    })

    // Flag stale/failed sources
    if (stale.length > 0) {
      await prisma.competitorSource.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { status: 'NEEDS_REVIEW' },
      })
    }

    const failed = sources.filter((s) => s.status === 'FAILED' || s.status === 'BLOCKED')

    return {
      summary: `Audited ${sources.length} sources. ${stale.length} stale, ${failed.length} failed.`,
      data: { totalSources: sources.length, staleCount: stale.length, failedCount: failed.length },
    }
  },
}

// ─── Step 2: Evidence Collection ─────────────────────────────────────────────

const evidenceCollection: WorkflowStepDefinition = {
  name: 'EVIDENCE_COLLECTION',
  required: true,
  async execute({ ctx, aiClient }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) throw new Error('competitorId required in params')

    const competitor = await prisma.competitor.findFirst({
      where: { id: competitorId, organizationId: ctx.orgId },
      include: { managedSources: { where: { isActive: true, status: 'ACTIVE' }, take: 10 } },
    })
    if (!competitor) throw new Error('Competitor not found')

    let tokensUsed = 0
    const sourcesProcessed: string[] = []
    let realCrawlCount = 0

    const crawlerAvailable = await isCrawl4AIAvailable()

    for (const source of competitor.managedSources.slice(0, 5)) {
      let pageContent = ''

      // Try real crawl if Crawl4AI is available
      if (crawlerAvailable) {
        const crawled = await crawlUrl({ url: source.url, timeout: 25000 })
        if (crawled.success && crawled.markdown) {
          pageContent = truncateForLLM(crawled.markdown, 6000)
        }
      }

      const now = new Date()

      // AUDIT S2-3: if no real content was fetched, do NOT ask the LLM to invent
      // signals "from what it knows" and do NOT stamp success. Record the source
      // as un-crawled and move on — fabricated intelligence must never be stored.
      if (!pageContent) {
        await prisma.competitorSource.update({
          where: { id: source.id },
          data: {
            lastCrawledAt: now,
            crawlHealthStatus: crawlerAvailable ? 'NO_CONTENT' : 'SIMULATED',
          },
        })
        continue
      }

      const prompt = `You are a competitive intelligence extraction agent. Analyze the following crawled content from ${source.url} for competitor "${competitor.name}".

CRAWLED CONTENT:
${pageContent}

Extract 2-5 competitive signals from this content. Return as JSON array: [{"signal": "...", "confidence": 0.9, "category": "AI Core|Automation|Integrations|Analytics|Security|Pricing|Other"}]. Return only JSON array.`

      const result = await aiClient.complete({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 600,
        temperature: 0.2,
      } as any)
      tokensUsed += result.totalTokens ?? 0
      sourcesProcessed.push(source.url)
      realCrawlCount++

      // Real content fetched — safe to mark a successful crawl.
      await prisma.competitorSource.update({
        where: { id: source.id },
        data: {
          lastCrawledAt: now,
          lastSuccessAt: now,
          status: 'ACTIVE',
          freshnessScore: 1.0,
          crawlHealthStatus: 'OK',
        },
      })
    }

    // AUDIT S2-3: only advance the competitor to ACTIVE if real evidence was collected.
    await prisma.competitor.update({
      where: { id: competitorId },
      data: { lastRefreshAt: new Date(), ...(realCrawlCount > 0 ? { setupStatus: 'ACTIVE' } : {}) },
    })

    return {
      summary: realCrawlCount > 0
        ? `Collected evidence from ${realCrawlCount} crawled source(s).`
        : `No source content could be crawled (crawler ${crawlerAvailable ? 'returned no content' : 'unavailable'}); no evidence collected.`,
      tokensUsed,
      data: { sourcesProcessed },
    }
  },
}

// ─── Step 3: Community Signals ────────────────────────────────────────────────

const communitySignals: WorkflowStepDefinition = {
  name: 'COMMUNITY_SIGNALS',
  required: false,
  async execute({ ctx, aiClient }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) return { summary: 'Skipped — no competitorId' }

    const competitor = await prisma.competitor.findFirst({
      where: { id: competitorId, organizationId: ctx.orgId },
    })
    if (!competitor) return { summary: 'Competitor not found' }

    // Load product category for more relevant queries
    const product = await prisma.product.findFirst({
      where: { organizationId: ctx.orgId },
      select: { name: true, description: true },
    })
    const categoryContext = product
      ? `Our product "${product.name}" is in the category: ${product.description || 'B2B SaaS'}. Use this context to make search queries more relevant to our market.`
      : ''

    const result = await aiClient.complete({
      messages: [{
        role: 'user',
        content: `Suggest 3 Reddit or HN search queries a PM would use to find community discussions about ${competitor.name}. ${categoryContext} Return as JSON array of strings. Example: ["${competitor.name} alternatives", "${competitor.name} pricing review"]. Return only JSON.`,
      }],
      maxTokens: 200,
      temperature: 0.3,
    } as any)

    let queries: string[] = []
    try {
      const match = result.content.match(/\[[\s\S]*\]/)
      if (match) queries = JSON.parse(match[0])
    } catch { /* ignore */ }

    return {
      summary: `Generated ${queries.length} community search queries for ${competitor.name}.`,
      tokensUsed: result.totalTokens ?? 0,
      data: { queries },
    }
  },
}

// ─── Step 4: Change Detection ─────────────────────────────────────────────────

const changeDetection: WorkflowStepDefinition = {
  name: 'CHANGE_DETECTION',
  required: true,
  async execute({ ctx, aiClient, previousResults }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) throw new Error('competitorId required in params')

    const competitor = await prisma.competitor.findFirst({
      where: { id: competitorId, organizationId: ctx.orgId },
      include: { features: { orderBy: { updatedAt: 'desc' }, take: 20 } },
    })
    if (!competitor) throw new Error('Competitor not found')

    // AUDIT S2-3: change detection must be grounded in real crawled evidence.
    // Previously this asked the LLM to invent "a realistic recent change" from its
    // training knowledge and persisted it as a tracked competitor update — i.e.
    // fabricated intelligence presented as fact. If the evidence step crawled no
    // real content, we create nothing rather than hallucinate.
    const evidence = (previousResults?.['EVIDENCE_COLLECTION']?.data as Record<string, any> | undefined)
    const crawledSources: string[] = evidence?.sourcesProcessed ?? []

    if (crawledSources.length === 0) {
      return {
        summary: 'No crawled evidence available — no changes detected (skipped fabricated updates).',
        data: { updatesCreated: 0, evidenceBacked: true },
      }
    }

    // Re-crawl the evidence sources and detect genuinely new content-derived
    // changes. Only updates backed by fetched content are persisted.
    const existingUpdates = await prisma.competitorKeyUpdate.findMany({
      where: { competitorId },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    })
    const existingTitles = existingUpdates.map(u => u.title)

    const sources = await prisma.competitorSource.findMany({
      where: { competitorId, url: { in: crawledSources } },
      take: 5,
    })

    const VALID_SIGNIFICANCE = ['HIGH', 'MEDIUM_HIGH', 'MEDIUM', 'LOW'] as const
    let created = 0
    let tokensUsed = 0

    for (const source of sources) {
      const crawled = await crawlUrl({ url: source.url, timeout: 25000 })
      if (!crawled.success || !crawled.markdown) continue // evidence required
      const pageContent = truncateForLLM(crawled.markdown, 6000)

      const result = await aiClient.complete({
        messages: [{
          role: 'user',
          content: `You are a competitive change-detection agent. From the crawled content below for "${competitor.name}", identify at most 1 notable product/pricing change that is explicitly supported by the content. If nothing notable is present, return {}.

CRAWLED CONTENT:
${pageContent}

Return only JSON: {"title": "...", "updateType": "NEW_FEATURE|ENHANCEMENT|PRICING_CHANGE", "description": "...", "significance": "HIGH|MEDIUM_HIGH|MEDIUM|LOW"}.
Do NOT infer beyond the content. Do NOT duplicate any of these already-tracked updates: ${existingTitles.join('; ')}`,
        }],
        maxTokens: 300,
        temperature: 0.2,
      } as any)
      tokensUsed += result.totalTokens ?? 0

      try {
        const match = result.content.match(/\{[\s\S]*\}/)
        if (match) {
          const change = JSON.parse(match[0])
          if (change.title && !existingTitles.includes(change.title)) {
            const significance = VALID_SIGNIFICANCE.includes(change.significance) ? change.significance : 'MEDIUM'
            await prisma.competitorKeyUpdate.create({
              data: {
                competitorId,
                updateType: change.updateType ?? 'ENHANCEMENT',
                title: change.title,
                description: change.description ?? '',
                significance,
                detectedAt: new Date(),
                sourceUrl: source.url,
              },
            })
            existingTitles.push(change.title)
            created++
            // AUDIT S3-4: real notification dispatch (no-op if Google Chat isn't connected).
            void notifyGoogleChat(ctx.orgId, `🔔 New update for competitor "${competitor.name}": ${change.title}`)
          }
        }
      } catch { /* ignore malformed JSON */ }
    }

    return {
      summary: `Change detection complete (evidence-backed). ${created} new update${created === 1 ? '' : 's'} created.`,
      tokensUsed,
      data: { updatesCreated: created, evidenceBacked: true },
    }
  },
}

// ─── Step 5: Report Generation ────────────────────────────────────────────────

const reportGeneration: WorkflowStepDefinition = {
  name: 'REPORT_GENERATION',
  required: false,
  async execute({ ctx }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) return { summary: 'Skipped — no competitorId' }

    try {
      const report = await generateCompetitorReport(competitorId, ctx.orgId)
      return {
        summary: `Intelligence report generated successfully.`,
        data: { reportId: report.id, status: report.status },
      }
    } catch (err) {
      return {
        summary: `Report generation failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        data: { failed: true },
      }
    }
  },
}

// ─── Step 6: Battlecard Update ────────────────────────────────────────────────

const battlecardUpdate: WorkflowStepDefinition = {
  name: 'BATTLECARD_UPDATE',
  required: false,
  async execute({ ctx, previousResults }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) return { summary: 'Skipped — no competitorId' }

    const battleCard = await prisma.battleCard.findFirst({
      where: {
        organizationId: ctx.orgId,
        competitors: { some: { id: competitorId } },
      },
    })

    if (!battleCard) {
      return { summary: 'No battle card found for this competitor — skipping update.' }
    }

    // Check if REPORT_GENERATION produced a report via previousResults
    const reportResult = previousResults?.['REPORT_GENERATION']
    const reportData = reportResult?.data as Record<string, any> | undefined
    const reportId = reportData?.reportId
    const reportFailed = reportData?.failed

    if (reportFailed) {
      return { summary: 'Report generation failed — cannot update battle card.' }
    }

    // Use report from previousResults if available, otherwise query DB
    let report = null
    if (reportId) {
      report = await prisma.competitorReport.findFirst({
        where: { id: reportId, status: 'READY' },
      })
    }
    if (!report) {
      report = await prisma.competitorReport.findFirst({
        where: { competitorId, organizationId: ctx.orgId, status: 'READY' },
        orderBy: { generatedAt: 'desc' },
      })
    }

    if (!report) {
      return { summary: 'No ready report available for battle card update — skipping.' }
    }

    // Mark battle card as potentially stale
    return {
      summary: `Battle card "${battleCard.title}" flagged for refresh. Use "Refresh from Report" in the Battle Cards module.`,
      data: { battleCardId: battleCard.id, reportId: report.id },
    }
  },
}

// ─── Workflow Definition ──────────────────────────────────────────────────────

export const competitorDeepAnalysisWorkflow: WorkflowDefinition = {
  type: 'COMPETITOR_DEEP_ANALYSIS',
  steps: [
    sourceAudit,
    evidenceCollection,
    communitySignals,
    changeDetection,
    reportGeneration,
    battlecardUpdate,
  ],
}
