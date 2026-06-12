import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import { getServerSession } from 'next-auth'

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.organizationId

  const [ourFeatures, competitors, accounts, existingItems] = await Promise.all([
    prisma.ourFeature.findMany({ where: { product: { organizationId: orgId } }, take: 20 }),
    prisma.competitor.findMany({
      where: { organizationId: orgId },
      include: { features: { take: 10 } },
      take: 5,
    }),
    prisma.account.findMany({
      where: { organizationId: orgId },
      include: { updates: { take: 5, orderBy: { createdAt: 'desc' } } },
      take: 10,
    }),
    prisma.roadmapItem.findMany({
      where: { product: { organizationId: orgId } },
      take: 20,
    }),
  ])

  const prompt = `You are a product strategy assistant. Based on the following data, suggest 5 high-impact roadmap items.

Our features: ${ourFeatures.map(f => f.name).join(', ')}

Competitor features: ${competitors.flatMap(c => c.features.map(f => `${c.name}: ${f.name}`)).join(', ')}

Account feedback topics: ${accounts.flatMap(a => a.updates.flatMap(u => JSON.parse(u.featureRequestsJson as any || '[]'))).slice(0, 20).join(', ')}

Existing roadmap: ${existingItems.map(i => i.title).join(', ')}

Return a JSON array of 5 items with: {title, description, sourceType ("COMPETITOR_GAP"|"ACCOUNT_FEEDBACK"|"STRATEGIC"), priority("HIGH"|"MEDIUM"), rationale}`

  try {
    const aiClient = await getAIClient(orgId)
    const result = await aiClient.complete({
      messages: [{ role: 'user', content: prompt }],
      model: 'claude-sonnet-4-6',
    })

    const suggestions = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]')

    const product = await prisma.product.findFirst({ where: { organizationId: orgId } })
    if (!product) return NextResponse.json([])

    const created = await Promise.all(
      suggestions.slice(0, 5).map((s: any) =>
        prisma.roadmapItem.create({
          data: {
            productId: product.id,
            title: s.title,
            description: s.description || '',
            sourceType: (['COMPETITOR_GAP', 'ACCOUNT_FEEDBACK', 'MANUAL', 'AI_GENERATED'].includes(s.sourceType) ? s.sourceType : 'AI_GENERATED') as any,
            status: 'IDEA',
            isAiSuggested: true,
            sortOrder: 9999,
          },
        })
      )
    )

    return NextResponse.json(created)
  } catch (e) {
    console.error('AI suggestions error:', e)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }
}
