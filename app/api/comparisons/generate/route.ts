import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import { z } from 'zod'

const schema = z.object({
  ourFeatureId: z.string(),
  competitorId: z.string(),
  competitorFeatureIds: z.array(z.string()).optional(),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = schema.parse(await req.json())

    const [ourFeature, competitor, competitorFeatures] = await Promise.all([
      prisma.ourFeature.findFirst({
        where: { id: body.ourFeatureId, product: { organizationId: orgId } },
      }),
      prisma.competitor.findFirst({
        where: { id: body.competitorId, organizationId: orgId },
      }),
      body.competitorFeatureIds?.length
        ? prisma.competitorFeature.findMany({
            where: { id: { in: body.competitorFeatureIds }, competitorId: body.competitorId },
          })
        : prisma.competitorFeature.findMany({
            where: { competitorId: body.competitorId },
            take: 5,
          }),
    ])

    if (!ourFeature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
    if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

    const aiClient = await getAIClient(orgId)

    const prompt = `You are a senior product strategist performing a competitive feature analysis.

OUR FEATURE:
Name: ${ourFeature.name}
Description: ${ourFeature.description || 'No description'}
Category: ${ourFeature.category}

COMPETITOR: ${competitor.name}
THEIR FEATURES:
${competitorFeatures.length > 0
  ? competitorFeatures.map(f => `- ${f.name}: ${f.description || f.category}`).join('\n')
  : `No specific features listed for ${competitor.name}`}

Analyze how our feature compares to the competitor's capabilities. Return a JSON object with these exact keys:
- positioning: one of "AHEAD", "BEHIND", "PARTIAL", "EQUIVALENT", "NO_MATCH"
- similaritiesText: 1-3 sentences on what both products do similarly
- differencesText: 1-3 sentences on key differences and where we diverge
- enhancementOpportunitiesText: 1-2 sentences on what we could improve based on this comparison
- keyTakeawaysText: 1-2 sentences on the most important competitive insight

Be specific, factual, and concise. Return valid JSON only.`

    const result = await aiClient.complete({
      model: aiClient.defaultModel,
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst. Return valid JSON only, no markdown.' },
        { role: 'user', content: prompt },
      ],
      jsonMode: true,
    })

    let parsed: any = {}
    try { parsed = JSON.parse(result.content) } catch {}

    const comparison = await prisma.comparison.upsert({
      where: {
        ourFeatureId_competitorId: {
          ourFeatureId: body.ourFeatureId,
          competitorId: body.competitorId,
        },
      },
      create: {
        ourFeatureId: body.ourFeatureId,
        competitorId: body.competitorId,
        positioning: parsed.positioning ?? 'NO_MATCH',
        similaritiesText: parsed.similaritiesText ?? '',
        differencesText: parsed.differencesText ?? '',
        enhancementOpportunitiesText: parsed.enhancementOpportunitiesText ?? '',
        keyTakeawaysText: parsed.keyTakeawaysText ?? '',
      },
      update: {
        positioning: parsed.positioning ?? 'NO_MATCH',
        similaritiesText: parsed.similaritiesText ?? '',
        differencesText: parsed.differencesText ?? '',
        enhancementOpportunitiesText: parsed.enhancementOpportunitiesText ?? '',
        keyTakeawaysText: parsed.keyTakeawaysText ?? '',
      },
      include: { ourFeature: true, competitor: true },
    })

    return NextResponse.json(comparison)
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
