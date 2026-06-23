import { prisma } from '@/lib/db'
import { crawlUrl, isCrawl4AIAvailable, truncateForLLM } from '@/lib/crawler/crawl4ai'
import type { WorkflowDefinition, WorkflowStepDefinition } from '@/types/workflow'

const crawlCompetitors: WorkflowStepDefinition = {
  name: 'CRAWL_COMPETITORS',
  required: true,
  async execute({ ctx, aiClient }) {
    const competitors = await prisma.competitor.findMany({
      where: { organizationId: ctx.orgId, monitoringEnabled: true },
      include: { features: { take: 20, orderBy: { updatedAt: 'desc' } } },
    })

    if (!competitors.length) {
      return { summary: 'No competitors to crawl', tokensUsed: 0 }
    }

    let tokensUsed = 0

    for (const competitor of competitors) {
      if (!competitor.website) continue

      // Try to crawl the competitor's website for real content
      let pageContent = ''
      const crawlerAvailable = await isCrawl4AIAvailable()
      if (crawlerAvailable) {
        const crawled = await crawlUrl({ url: competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`, timeout: 25000 })
        if (crawled.success && crawled.markdown) {
          pageContent = truncateForLLM(crawled.markdown, 6000)
        }
      }

      const prompt = pageContent
        ? `You are a competitive intelligence agent. Analyze the following crawled content from ${competitor.name} (${competitor.website}):

CRAWLED CONTENT:
${pageContent}

Identify their top 3 most recent product features or updates. Format each as JSON with fields: name, description, category. Return a JSON array.`
        : `You are a competitive intelligence agent. Analyze ${competitor.name} (${competitor.website}) and identify their top 3 most recent product features or updates. Format each as JSON with fields: name, description, category. Return a JSON array.`

      // Load existing features for deduplication
      const existingFeatureNames = competitor.features.map(f => f.name)
      const deduplicationNote = existingFeatureNames.length
        ? `\n\nDo not suggest features that duplicate these existing ones: ${existingFeatureNames.join(', ')}`
        : ''

      const result = await aiClient.complete({
        messages: [{ role: 'user', content: prompt + deduplicationNote }],
      })
      tokensUsed += result.totalTokens ?? 0

      try {
        const features = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]')
        for (const feature of features.slice(0, 3)) {
          await prisma.competitorFeature.upsert({
            where: { id: `synth-${competitor.id}-${feature.name.slice(0, 20)}` },
            create: {
              id: `synth-${competitor.id}-${feature.name.slice(0, 20)}`,
              competitorId: competitor.id,
              name: feature.name,
              description: feature.description || '',
              category: feature.category || 'General',
            },
            update: {
              description: feature.description || '',
              updatedAt: new Date(),
            },
          }).catch(() => {}) // ignore if ID collision
        }
      } catch {}

      await prisma.competitor.update({
        where: { id: competitor.id },
        data: { lastRefreshAt: new Date() },
      })
    }

    return {
      summary: `Crawled ${competitors.length} competitors`,
      tokensUsed,
    }
  },
}

const detectChanges: WorkflowStepDefinition = {
  name: 'DETECT_CHANGES',
  required: false,
  async execute({ ctx, aiClient, previousResults }) {
    const recentFeatures = await prisma.competitorFeature.findMany({
      where: {
        competitor: { organizationId: ctx.orgId },
        updatedAt: { gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      },
      include: { competitor: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    let tokensUsed = 0
    let created = 0

    for (const feature of recentFeatures) {
      const existing = await prisma.competitorKeyUpdate.findFirst({
        where: { competitorId: feature.competitorId, title: { contains: feature.name } },
      })
      if (existing) continue

      await prisma.competitorKeyUpdate.create({
        data: {
          competitorId: feature.competitorId,
          updateType: 'NEW_FEATURE',
          title: `New feature: ${feature.name}`,
          diffSummary: feature.description,
          pmActionStatus: 'PENDING',
        } as any,
      })
      created++

      // Create notification
      const org = await prisma.organization.findUnique({ where: { id: ctx.orgId } })
      if (org) {
        await prisma.notification.create({
          data: {
            organizationId: ctx.orgId,
            type: 'COMPETITOR_UPDATE',
            message: `${feature.competitor.name} released: ${feature.name}`,
            entityType: 'CompetitorKeyUpdate',
          } as any,
        })
      }
    }

    return {
      summary: `Created ${created} key update records`,
      tokensUsed,
    }
  },
}

const analyzeGaps: WorkflowStepDefinition = {
  name: 'ANALYZE_GAPS',
  required: false,
  async execute({ ctx, aiClient }) {
    const ourFeatures = await prisma.ourFeature.findMany({
      where: { product: { organizationId: ctx.orgId } },
    })
    const competitorFeatures = await prisma.competitorFeature.findMany({
      where: { competitor: { organizationId: ctx.orgId } },
      include: { competitor: true },
    })

    if (!ourFeatures.length || !competitorFeatures.length) {
      return { summary: 'Insufficient data for gap analysis', tokensUsed: 0 }
    }

    const ourFeatureList = ourFeatures.map(f => ({ name: f.name, status: f.status }))

    const result = await aiClient.complete({
      messages: [
        {
          role: 'user',
          content: `You are a competitive gap analysis agent.

OUR PRODUCT FEATURES (what we already have):
${JSON.stringify(ourFeatureList, null, 2)}

COMPETITOR FEATURES:
${JSON.stringify(competitorFeatures.slice(0, 20).map(f => ({ name: f.name, competitor: f.competitor.name })), null, 2)}

Identify the top 3 feature gaps where competitors have capabilities we lack. Only include gaps for features we do NOT already have. Return JSON array with: {gap, priority, competitor, recommendation}`,
        },
      ],
    })

    const tokensUsed = result.totalTokens ?? 0

    try {
      const gaps = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]')
      for (const gap of gaps.slice(0, 3)) {
        const product = await prisma.product.findFirst({ where: { organizationId: ctx.orgId } })
        if (!product) continue
        await prisma.roadmapItem.create({
          data: {
            productId: product.id,
            title: gap.gap,
            description: gap.recommendation || '',
            sourceType: 'COMPETITOR_GAP',
            status: 'IDEA',
            isAiSuggested: true,
            sortOrder: 9999,
          },
        }).catch(() => {})
      }
    } catch {}

    return { summary: `Gap analysis completed`, tokensUsed }
  },
}

export const competitorRefreshWorkflow: WorkflowDefinition = {
  type: 'COMPETITOR_REFRESH',
  steps: [crawlCompetitors, detectChanges, analyzeGaps],
}
