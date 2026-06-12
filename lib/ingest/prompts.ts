/**
 * After document ingestion, upsert system prompts that include real product data.
 * These prompts are used by workflows (gap analysis, battle cards, spec gen, etc.)
 */

import { prisma } from '@/lib/db'

interface PromptContext {
  productName: string
  ourFeatures: { name: string; description: string; category: string }[]
  competitors: { name: string; features: { name: string }[] }[]
}

async function buildContext(orgId: string): Promise<PromptContext> {
  const product = await prisma.product.findFirst({
    where: { organizationId: orgId },
    include: {
      ourFeatures: { select: { name: true, description: true, category: true }, take: 100 },
    },
  })

  const competitors = await prisma.competitor.findMany({
    where: { organizationId: orgId },
    include: { features: { select: { name: true }, take: 50 } },
    take: 20,
  })

  return {
    productName: product?.name ?? 'Our Product',
    ourFeatures: product?.ourFeatures ?? [],
    competitors,
  }
}

function featureListText(features: { name: string; description: string; category: string }[]): string {
  if (features.length === 0) return '(No features loaded yet)'
  const byCategory: Record<string, string[]> = {}
  for (const f of features) {
    if (!byCategory[f.category]) byCategory[f.category] = []
    byCategory[f.category].push(`- ${f.name}${f.description ? ': ' + f.description.slice(0, 120) : ''}`)
  }
  return Object.entries(byCategory)
    .map(([cat, items]) => `**${cat}**\n${items.join('\n')}`)
    .join('\n\n')
}

function competitorListText(competitors: { name: string; features: { name: string }[] }[]): string {
  if (competitors.length === 0) return '(No competitors loaded yet)'
  return competitors
    .map((c) => `**${c.name}**: ${c.features.map((f) => f.name).join(', ') || 'no features recorded'}`)
    .join('\n')
}

const PROMPT_TEMPLATES = (ctx: PromptContext) => [
  {
    category: 'gap_analysis',
    name: 'Gap Analysis',
    description: 'Analyzes capability gaps between our product and competitors',
    templateText: `You are a product intelligence analyst. Analyze capability gaps between ${ctx.productName} and competitors.

## Our Product: ${ctx.productName}
${featureListText(ctx.ourFeatures)}

## Competitors
${competitorListText(ctx.competitors)}

## Task
Identify features that competitors have that we lack, features where we are behind, and areas where we lead. Structure your response as JSON with keys: gaps, leads, opportunities.`,
    variablesJson: JSON.stringify([]),
  },
  {
    category: 'battle_card',
    name: 'Battle Card Generation',
    description: 'Generates competitive battle cards for sales and PM use',
    templateText: `You are a competitive intelligence expert. Generate a battle card for ${ctx.productName} vs a competitor.

## Our Product: ${ctx.productName}
${featureListText(ctx.ourFeatures)}

## Competitors Available
${competitorListText(ctx.competitors)}

## Task
For the given competitor, create a structured battle card with:
- Strengths (where we win)
- Weaknesses (where we lose)
- Key differentiators
- Sales messaging
- PM takeaways

Respond in JSON format.`,
    variablesJson: JSON.stringify(['competitor_name', 'competitor_features']),
  },
  {
    category: 'spec_generation',
    name: 'Spec Generation',
    description: 'Generates feature specification documents in Markdown',
    templateText: `You are a senior product manager at a company that builds ${ctx.productName}.
Write a detailed product specification document in Markdown for a new feature or enhancement.

## Our Current Feature Set
${featureListText(ctx.ourFeatures)}

## Competitive Context
${competitorListText(ctx.competitors)}

## Task
Given the feature title and description provided, write a complete PRD/spec including:
- Overview & Goals
- User Stories
- Functional Requirements
- Acceptance Criteria
- Edge Cases
- Success Metrics

Use proper Markdown formatting.`,
    variablesJson: JSON.stringify(['feature_title', 'feature_description', 'target_users']),
  },
  {
    category: 'feature_enrichment',
    name: 'Competitor Feature Enrichment',
    description: 'Enriches competitor feature data with analysis',
    templateText: `You are a competitive intelligence researcher analyzing features for ${ctx.productName}'s competitors.

## Our Product: ${ctx.productName}
Key features: ${ctx.ourFeatures.slice(0, 20).map((f) => f.name).join(', ') || '(not loaded)'}

## Task
For the competitor feature provided, analyze:
- Pros of this feature
- Cons or limitations
- Market sentiment (based on your knowledge)
- How it compares to our equivalent feature
- Roadmap implication for us

Respond in JSON with keys: prosText, consText, marketSentimentText, roadmapImplicationText, matchStatus (AHEAD/BEHIND/PARTIAL/DIFFERENT_APPROACH/NO_MATCH).`,
    variablesJson: JSON.stringify(['competitor_name', 'feature_name', 'feature_description', 'our_feature_name']),
  },
  {
    category: 'feature_comparison',
    name: 'Feature Comparison Analysis',
    description: 'Deep comparison between our feature and a competitor feature',
    templateText: `You are a product analyst comparing features between ${ctx.productName} and a competitor.

## Our Product Features
${featureListText(ctx.ourFeatures)}

## Task
Compare our feature with the competitor's equivalent feature. Provide:
- Similarities
- Differences
- Enhancement opportunities
- Key takeaways
- Overall positioning (AHEAD/BEHIND/PARTIAL/DIFFERENT_APPROACH/NO_MATCH)

Respond in JSON.`,
    variablesJson: JSON.stringify(['our_feature', 'competitor_name', 'competitor_feature']),
  },
]

export async function upsertSystemPrompts(orgId: string): Promise<{ upserted: number }> {
  const ctx = await buildContext(orgId)
  const templates = PROMPT_TEMPLATES(ctx)
  let upserted = 0

  for (const tpl of templates) {
    const existing = await prisma.prompt.findFirst({
      where: { organizationId: orgId, category: tpl.category, isDefault: true },
    })

    if (existing) {
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          templateText: tpl.templateText,
          variablesJson: tpl.variablesJson,
          version: existing.version + 1,
        },
      })
    } else {
      await prisma.prompt.create({
        data: {
          organizationId: orgId,
          category: tpl.category,
          name: tpl.name,
          description: tpl.description,
          templateText: tpl.templateText,
          variablesJson: tpl.variablesJson,
          isDefault: true,
          isActive: true,
          version: 1,
        },
      })
    }
    upserted++
  }

  return { upserted }
}
