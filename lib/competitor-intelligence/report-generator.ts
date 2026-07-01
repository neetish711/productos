import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'

const REPORT_SYSTEM_PROMPT = `You are a senior competitive intelligence analyst. Your job is to write comprehensive, actionable competitor analysis reports for product managers. Be specific, evidence-based, and avoid speculation. Structure your report clearly with the exact 13 sections specified. Use markdown formatting.`

const REPORT_SECTIONS = [
  '## 1. Executive Summary',
  '## 2. Company & Product Positioning',
  '## 3. Product Capabilities',
  '## 4. Pricing & Packaging',
  '## 5. Security & Compliance',
  '## 6. Ecosystem & Developer Readiness',
  '## 7. Community & Market Sentiment',
  '## 8. Historical Changes',
  '## 9. Competitive Comparison',
  '## 10. Risks & Unknowns',
  '## 11. PM Takeaways',
  '## 12. Sales / GTM Takeaways',
  '## 13. Evidence Appendix',
]

export async function generateCompetitorReport(competitorId: string, orgId: string) {
  // 1. Fetch all relevant data
  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId, organizationId: orgId },
    include: {
      features: {
        include: { sourceEvidence: { take: 3, orderBy: { confidence: 'desc' } } },
        orderBy: { category: 'asc' },
      },
      keyUpdates: {
        orderBy: { detectedAt: 'desc' },
        take: 20,
      },
      managedSources: {
        where: { isActive: true },
        orderBy: { priority: 'asc' },
      },
    },
  })

  if (!competitor) throw new Error('Competitor not found')

  // 2. Get existing battle card if any
  const battleCard = await prisma.battleCard.findFirst({
    where: { organizationId: orgId, competitors: { some: { id: competitorId } } },
  })

  // 3. Find existing IN_PROGRESS report and mark as failed before creating new
  await prisma.competitorReport.updateMany({
    where: { competitorId, organizationId: orgId, status: 'IN_PROGRESS' },
    data: { status: 'FAILED', errorMessage: 'Replaced by new generation run' },
  })

  // 4. Create report record
  const report = await prisma.competitorReport.create({
    data: {
      competitorId,
      organizationId: orgId,
      title: `${competitor.name} — Intelligence Report`,
      status: 'IN_PROGRESS',
      evidenceCount: competitor.features.reduce((sum, f) => sum + f.sourceEvidence.length, 0),
      sourceCount: competitor.managedSources.length,
    },
  })

  try {
    // 5. Build context
    const featuresByCategory = competitor.features.reduce<Record<string, typeof competitor.features>>((acc, f) => {
      const cat = f.category || 'General'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(f)
      return acc
    }, {})

    // AUDIT S2-2: bound each assembled block so a competitor with hundreds of
    // features/updates can't overflow the model context and 500 the generation.
    const clamp = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max) + '\n[... truncated ...]')

    const featuresContext = clamp(Object.entries(featuresByCategory).map(([cat, features]) => {
      const featureList = features.map((f) => {
        const evidence = f.sourceEvidence.slice(0, 3).map((e) => `  - [${e.sourceType}] "${e.snippet.slice(0, 120)}" (${e.url})`).join('\n')
        return `  **${f.name}**: ${(f.description || '').slice(0, 400)}\n${evidence}`
      }).join('\n')
      return `### ${cat}\n${featureList}`
    }).join('\n\n'), 30_000)

    const updatesContext = clamp(competitor.keyUpdates.map((u) =>
      `- [${u.detectedAt.toISOString().split('T')[0]}] ${u.title}: ${(u.description || u.diffSummaryText || '').slice(0, 400)}`
    ).join('\n'), 8_000)

    const sourcesContext = clamp(competitor.managedSources.map((s) =>
      `- ${s.label || s.url} (${s.sourceType}, ${s.status})`
    ).join('\n'), 4_000)

    const battleCardContext = battleCard
      ? `\n### Existing Battle Card\nStrengths: ${battleCard.strengthsText}\nWeaknesses: ${battleCard.weaknessesText}\nDifferentiators: ${battleCard.differentiatorsText}`
      : ''

    const userPrompt = `Generate a comprehensive competitive intelligence report for **${competitor.name}**.

## Competitor Context
- **Name**: ${competitor.name}
- **Website**: ${competitor.website || 'Unknown'}
- **Description**: ${competitor.description || 'Not provided'}
- **Total Features Tracked**: ${competitor.features.length}
- **Recent Updates (last 20)**: ${competitor.keyUpdates.length}

## Product Features (by Category)
${featuresContext || 'No features tracked yet.'}

## Recent Key Updates
${updatesContext || 'No updates tracked yet.'}

## Monitored Sources
${sourcesContext || 'No sources configured yet.'}
${battleCardContext}

## Instructions
Write a complete intelligence report using exactly these 13 section headers:
${REPORT_SECTIONS.join('\n')}

For each section:
- **Executive Summary**: 2-3 paragraph overview of competitive threat level, key differentiators, and top 3 action items
- **Company & Product Positioning**: How they position in market, target segments, messaging
- **Product Capabilities**: Detailed breakdown of what they can do; reference specific features
- **Pricing & Packaging**: Tiers, price points, packaging strategy, changes
- **Security & Compliance**: Certifications, posture, trust signals
- **Ecosystem & Developer Readiness**: Integrations, API quality, partner ecosystem
- **Community & Market Sentiment**: Customer reviews, community activity, NPS signals
- **Historical Changes**: Timeline of significant product/pricing/strategy changes
- **Competitive Comparison**: Direct comparison to our product — where we win/lose
- **Risks & Unknowns**: Gaps in intelligence, what we don't know, watch areas
- **PM Takeaways**: 3-5 specific action items for the product team
- **Sales / GTM Takeaways**: 3-5 specific talking points and objection handlers
- **Evidence Appendix**: List of sources cited in this report with URLs

Be specific and actionable. Reference evidence where available. Do not hallucinate features not in the data.`

    // 6. Call LLM
    const ai = await getAIClient(orgId)
    const response = await ai.complete({
      messages: [
        { role: 'system', content: REPORT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 6000,
    } as any)

    const contentMd = response.content
    const executiveSummary = extractExecutiveSummary(contentMd)

    // 7. Get current version count
    const versionCount = await prisma.competitorReportVersion.count({ where: { reportId: report.id } })

    // 8. Save report version
    await prisma.competitorReportVersion.create({
      data: {
        reportId: report.id,
        version: versionCount + 1,
        contentMd,
      },
    })

    // 9. Update report record
    const updatedReport = await prisma.competitorReport.update({
      where: { id: report.id },
      data: {
        status: 'READY',
        contentMd,
        executiveSummary,
        generatedAt: new Date(),
        modelUsed: response.model,
        promptTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    })

    // 10. Update competitor reportStatus
    await prisma.competitor.update({
      where: { id: competitorId },
      data: { reportStatus: 'READY', lastReportAt: new Date() },
    })

    return updatedReport
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await prisma.competitorReport.update({
      where: { id: report.id },
      data: { status: 'FAILED', errorMessage: message },
    })
    await prisma.competitor.update({
      where: { id: competitorId },
      data: { reportStatus: 'FAILED' },
    })
    throw err
  }
}

function extractExecutiveSummary(contentMd: string): string {
  const match = contentMd.match(/##\s*1\.\s*Executive Summary\s*\n([\s\S]*?)(?=\n##\s*2\.)/i)
  if (!match) return ''
  return match[1].trim().slice(0, 1000)
}
