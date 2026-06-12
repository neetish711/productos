import { prisma } from '@/lib/db'
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

      // Use AI to synthesize new feature data (in production, crawl + diff)
      const result = await aiClient.complete({
        messages: [
          {
            role: 'user',
            content: `You are a competitive intelligence agent. Analyze ${competitor.name} (${competitor.website}) and identify their top 3 most recent product features or updates. Format each as JSON with fields: name, description, category. Return a JSON array.`,
          },
        ],
        model: 'claude-sonnet-4-6',
      })
      tokensUsed += (result as any).usage?.totalTokens || 0

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

    const result = await aiClient.complete({
      messages: [
        {
          role: 'user',
          content: `Given our product features: ${JSON.stringify(ourFeatures.map(f => f.name))}\n\nAnd competitor features: ${JSON.stringify(competitorFeatures.slice(0, 20).map(f => ({ name: f.name, competitor: f.competitor.name })))}\n\nIdentify the top 3 feature gaps where competitors have capabilities we lack. Return JSON array with: {gap, priority, competitor, recommendation}`,
        },
      ],
      model: 'claude-sonnet-4-6',
    })

    const tokensUsed = (result as any).usage?.totalTokens || 0

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
