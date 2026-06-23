import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import { z } from 'zod'

const schema = z.object({
  ourFeatureIds: z.array(z.string()).default([]),
  competitorFeatureIds: z.array(z.string()).default([]),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = schema.parse(await req.json())

    if (body.ourFeatureIds.length === 0 && body.competitorFeatureIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one feature to analyze' }, { status: 400 })
    }

    // Load selected features
    const [selectedOurFeatures, selectedCompetitorFeatures] = await Promise.all([
      body.ourFeatureIds.length > 0
        ? prisma.ourFeature.findMany({
            where: { id: { in: body.ourFeatureIds }, product: { organizationId: orgId } },
            select: { id: true, name: true, category: true, description: true },
          })
        : [],
      body.competitorFeatureIds.length > 0
        ? prisma.competitorFeature.findMany({
            where: { id: { in: body.competitorFeatureIds }, competitor: { organizationId: orgId } },
            include: { competitor: { select: { id: true, name: true } } },
          })
        : [],
    ])

    // Load ALL features as context
    const [allOurFeatures, allCompetitorFeatures] = await Promise.all([
      prisma.ourFeature.findMany({
        where: { product: { organizationId: orgId } },
        select: { id: true, name: true, category: true, description: true },
        take: 40,
      }),
      prisma.competitorFeature.findMany({
        where: { competitor: { organizationId: orgId } },
        include: { competitor: { select: { id: true, name: true } } },
        take: 80,
      }),
    ])

    // Build context blocks
    const ourFeaturesContext = allOurFeatures
      .map(f => `- [OUR] "${f.name}" (${f.category}): ${f.description || 'No description'}`)
      .join('\n')

    // Group competitor features by competitor
    const byCompetitor = new Map<string, { name: string; features: typeof allCompetitorFeatures }>()
    for (const cf of allCompetitorFeatures) {
      const key = cf.competitor.id
      if (!byCompetitor.has(key)) byCompetitor.set(key, { name: cf.competitor.name, features: [] })
      byCompetitor.get(key)!.features.push(cf)
    }

    const competitorFeaturesContext = Array.from(byCompetitor.values())
      .map(({ name, features }) =>
        `${name}:\n${features.map(f => `  - "${f.name}" (${f.category}): ${f.description || f.category}`).join('\n')}`,
      )
      .join('\n\n')

    // Build selected features list
    const selectedItems: Array<{ id: string; name: string; category: string; description: string; ownerSide: string; ownerName?: string }> = [
      ...selectedOurFeatures.map(f => ({ id: f.id, name: f.name, category: f.category, description: f.description ?? '', ownerSide: 'ours' })),
      ...selectedCompetitorFeatures.map(f => ({ id: f.id, name: f.name, category: f.category, description: f.description ?? '', ownerSide: f.competitor.name, ownerName: f.competitor.name })),
    ]

    const selectedList = selectedItems
      .map((f, i) => `${i + 1}. "${f.name}" — from [${f.ownerSide === 'ours' ? 'OUR PRODUCT' : f.ownerSide}] (${f.category})`)
      .join('\n')

    const prompt = `You are a senior product strategist performing a competitive feature overlap analysis.

OUR PRODUCT FEATURES (full context):
${ourFeaturesContext}

COMPETITOR FEATURES (full context, grouped by competitor):
${competitorFeaturesContext}

---

SELECTED FEATURES TO ANALYZE:
${selectedList}

For each selected feature above, analyze its competitive overlap landscape using all the context provided.

Return a JSON object with the key "analyses" containing an array with one entry per selected feature.

Each entry must have exactly these fields:
- featureId: string (the feature's ID from the list above, preserve exactly)
- featureName: string
- featureCategory: string
- featureDescription: string (brief 1-sentence description of what this feature does)
- ownerSide: string ("ours" for our features, or the competitor name for competitor features)
- competitiveStanding: one of "AHEAD" | "BEHIND" | "EQUIVALENT" | "PARTIAL" | "UNIQUE" | "ADJACENT" | "NO_OVERLAP" | "NEEDS_REVIEW"
  - AHEAD: our product clearly leads in this capability
  - BEHIND: competitor clearly leads, we're lagging
  - EQUIVALENT: roughly the same capability on both sides
  - PARTIAL: one side has partial coverage of the other's capability
  - UNIQUE: this feature exists only on one side with no competitor equivalent
  - ADJACENT: related capabilities but targeting slightly different use cases
  - NO_OVERLAP: no meaningful overlap found in the data
  - NEEDS_REVIEW: ambiguous or insufficient data to determine
- overlapStrength: one of "strong" | "moderate" | "weak" | "minimal" | "none"
- overlappingFeatures: array of objects, each with:
  - featureName: string
  - ownerSide: string ("ours" or competitor name)
  - overlapStrength: "strong" | "moderate" | "weak" | "minimal"
  - notes: string (1 sentence on how they overlap)
- scenarioSummary: string (2-3 sentences on competitive landscape for this feature)
- reasoning: string (1-2 sentences explaining the competitiveStanding choice)

Be specific, evidence-based, and use only the features listed in context. Return valid JSON only.`

    const aiClient = await getAIClient(orgId)
    const result = await aiClient.complete({
      model: aiClient.defaultModel,
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst. Return valid JSON only, no markdown.' },
        { role: 'user', content: prompt },
      ],
      jsonMode: true,
      maxTokens: 4000,
    })

    let parsed: { analyses: unknown[] } = { analyses: [] }
    try { parsed = JSON.parse(result.content) } catch {}

    // Build a lookup map from feature name (lowercase) to selectedItem for robust matching
    const nameToItem = new Map<string, typeof selectedItems[number]>()
    const idToItem = new Map<string, typeof selectedItems[number]>()
    for (const item of selectedItems) {
      nameToItem.set(item.name.toLowerCase(), item)
      idToItem.set(item.id, item)
    }

    // Map IDs back — match by featureId first, then by featureName, then fall back
    const analyses = Array.isArray(parsed.analyses)
      ? parsed.analyses.map((a: any, i: number) => {
          const matchById = a.featureId ? idToItem.get(a.featureId) : undefined
          const matchByName = a.featureName ? nameToItem.get(a.featureName.toLowerCase()) : undefined
          const match = matchById ?? matchByName ?? selectedItems[i]
          return {
            ...a,
            featureId: match?.id ?? a.featureId ?? `item-${i}`,
          }
        })
      : []

    // Validate each analysis entry has required fields with defaults
    const validatedAnalyses = analyses.map((a: any) => ({
      featureId: a.featureId,
      featureName: a.featureName ?? 'Unknown',
      featureCategory: a.featureCategory ?? 'General',
      featureDescription: a.featureDescription ?? '',
      ownerSide: a.ownerSide ?? 'ours',
      competitiveStanding: ['AHEAD', 'BEHIND', 'EQUIVALENT', 'PARTIAL', 'UNIQUE', 'ADJACENT', 'NO_OVERLAP', 'NEEDS_REVIEW'].includes(a.competitiveStanding)
        ? a.competitiveStanding
        : 'NEEDS_REVIEW',
      overlapStrength: ['strong', 'moderate', 'weak', 'minimal', 'none'].includes(a.overlapStrength)
        ? a.overlapStrength
        : 'none',
      overlappingFeatures: Array.isArray(a.overlappingFeatures) ? a.overlappingFeatures : [],
      scenarioSummary: a.scenarioSummary ?? 'No analysis available.',
      reasoning: a.reasoning ?? 'Insufficient data for analysis.',
    }))

    return NextResponse.json({ analyses: validatedAnalyses })
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
