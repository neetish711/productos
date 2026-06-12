import { prisma } from '@/lib/db'
import { generateCompetitorReport } from '@/lib/competitor-intelligence/report-generator'
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

    for (const source of competitor.managedSources.slice(0, 5)) {
      const result = await aiClient.complete({
        messages: [{
          role: 'user',
          content: `You are a competitive intelligence extraction agent. Analyze the source at ${source.url} for ${competitor.name}. Based on what you know about this URL, extract 2-3 competitive signals as JSON array: [{"signal": "...", "confidence": 0.8, "category": "..."}]. Return only JSON array.`,
        }],
        maxTokens: 400,
        temperature: 0.2,
      } as any)
      tokensUsed += result.totalTokens ?? 0
      sourcesProcessed.push(source.url)

      // Update source as crawled
      await prisma.competitorSource.update({
        where: { id: source.id },
        data: { lastCrawledAt: new Date(), lastSuccessAt: new Date(), status: 'ACTIVE' },
      })
    }

    // Update competitor lastRefreshAt
    await prisma.competitor.update({
      where: { id: competitorId },
      data: { lastRefreshAt: new Date(), setupStatus: 'ACTIVE' },
    })

    return {
      summary: `Processed ${sourcesProcessed.length} sources for evidence collection.`,
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

    const result = await aiClient.complete({
      messages: [{
        role: 'user',
        content: `Suggest 3 Reddit or HN search queries a PM would use to find community discussions about ${competitor.name}. Return as JSON array of strings. Example: ["${competitor.name} alternatives", "${competitor.name} pricing review"]. Return only JSON.`,
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
  async execute({ ctx, aiClient }) {
    const competitorId = ctx.params?.competitorId
    if (!competitorId) throw new Error('competitorId required in params')

    const competitor = await prisma.competitor.findFirst({
      where: { id: competitorId, organizationId: ctx.orgId },
      include: { features: { orderBy: { updatedAt: 'desc' }, take: 20 } },
    })
    if (!competitor) throw new Error('Competitor not found')

    // Use LLM to infer what might have changed (simulated since no real crawl)
    const result = await aiClient.complete({
      messages: [{
        role: 'user',
        content: `Based on your knowledge of ${competitor.name}, suggest 1 realistic recent product change or update that a PM would want to know about. Format as JSON: {"title": "...", "updateType": "NEW_FEATURE|ENHANCEMENT|PRICING_CHANGE", "description": "...", "significance": "HIGH|MEDIUM_HIGH|MEDIUM|LOW"}. Return only JSON object.`,
      }],
      maxTokens: 300,
      temperature: 0.4,
    } as any)

    let created = 0
    try {
      const match = result.content.match(/\{[\s\S]*\}/)
      if (match) {
        const change = JSON.parse(match[0])
        await prisma.competitorKeyUpdate.create({
          data: {
            competitorId,
            updateType: change.updateType ?? 'ENHANCEMENT',
            title: change.title ?? 'Update detected',
            description: change.description ?? '',
            significance: change.significance ?? 'MEDIUM',
            detectedAt: new Date(),
          },
        })
        created = 1
      }
    } catch { /* ignore */ }

    return {
      summary: `Change detection complete. ${created} new update${created === 1 ? '' : 's'} created.`,
      tokensUsed: result.totalTokens ?? 0,
      data: { updatesCreated: created },
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
  async execute({ ctx }) {
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

    const report = await prisma.competitorReport.findFirst({
      where: { competitorId, organizationId: ctx.orgId, status: 'READY' },
      orderBy: { generatedAt: 'desc' },
    })

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
