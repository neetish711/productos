import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'

// POST /api/battle-cards/[id]/refresh-from-report
// Pulls latest competitor report and uses LLM to update battle card fields
export async function POST(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = await getOrgId()

    const battleCard = await prisma.battleCard.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!battleCard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Parse competitor IDs from the JSON field
    let competitorIds: string[] = []
    try {
      competitorIds = JSON.parse(battleCard.competitorIdsJson)
    } catch { /* empty array */ }

    if (competitorIds.length === 0) {
      return NextResponse.json({ error: 'No competitors linked to this battle card' }, { status: 400 })
    }

    // Find the first competitor with a READY report
    const report = await prisma.competitorReport.findFirst({
      where: {
        competitorId: { in: competitorIds },
        organizationId: orgId,
        status: 'READY',
      },
      include: { competitor: { select: { name: true } } },
      orderBy: { generatedAt: 'desc' },
    })

    if (!report || !report.contentMd) {
      return NextResponse.json({ error: 'No ready report found for linked competitors. Generate a report first.' }, { status: 404 })
    }

    // Use LLM to extract battlecard-relevant content from report
    const ai = await getAIClient(orgId)
    const prompt = `You are a competitive intelligence analyst. Extract battle card content from the following competitor intelligence report for "${report.competitor.name}".

Report:
${report.contentMd.slice(0, 4000)}

Extract and output JSON with exactly these fields:
{
  "strengthsText": "bullet list of their product strengths (2-4 items, one per line, prefixed with •)",
  "weaknessesText": "bullet list of their product weaknesses (2-4 items, one per line, prefixed with •)",
  "differentiatorsText": "bullet list of how we win against them / our key differentiators (2-4 items, one per line, prefixed with •)",
  "salesMessagingText": "2-3 sentences of sales messaging and objection handling for sales reps"
}

Output only valid JSON, no other text.`

    const response = await ai.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 800,
      jsonMode: true,
    } as any)

    let extracted: Record<string, string> = {}
    try {
      const text = response.content.trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const updated = await prisma.battleCard.update({
      where: { id: params.id },
      data: {
        strengthsText: extracted.strengthsText || battleCard.strengthsText,
        weaknessesText: extracted.weaknessesText || battleCard.weaknessesText,
        differentiatorsText: extracted.differentiatorsText || battleCard.differentiatorsText,
        salesMessagingText: extracted.salesMessagingText || battleCard.salesMessagingText,
      },
      include: { ourFeature: true },
    })

    return NextResponse.json({
      ...updated,
      _refreshedFrom: {
        reportId: report.id,
        competitorName: report.competitor.name,
        generatedAt: report.generatedAt,
      },
    })
  } catch (e) {
    console.error('[battle-cards/refresh-from-report]', e)
    return NextResponse.json({ error: 'Failed to refresh from report' }, { status: 500 })
  }
}
