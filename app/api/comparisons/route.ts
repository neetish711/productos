import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = getProductIdFromRequest(req)
    const comparisons = await prisma.comparison.findMany({
      where: {
        ourFeature: {
          product: { organizationId: orgId },
          ...(productId ? { productId } : {}),
        },
      },
      include: { ourFeature: true, competitor: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(comparisons)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

const upsertSchema = z.object({
  ourFeatureId: z.string(),
  competitorId: z.string(),
  positioning: z.enum(['AHEAD', 'BEHIND', 'PARTIAL', 'EQUIVALENT', 'NO_MATCH']).optional(),
  similaritiesText: z.string().optional(),
  differencesText: z.string().optional(),
  enhancementOpportunitiesText: z.string().optional(),
  keyTakeawaysText: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = upsertSchema.parse(await req.json())

    // Verify ownership
    const feature = await prisma.ourFeature.findFirst({
      where: { id: body.ourFeatureId, product: { organizationId: orgId } },
    })
    if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })

    const competitor = await prisma.competitor.findFirst({
      where: { id: body.competitorId, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

    const comparison = await prisma.comparison.upsert({
      where: { ourFeatureId_competitorId: { ourFeatureId: body.ourFeatureId, competitorId: body.competitorId } },
      create: {
        ourFeatureId: body.ourFeatureId,
        competitorId: body.competitorId,
        positioning: body.positioning ?? 'NO_MATCH',
        similaritiesText: body.similaritiesText ?? '',
        differencesText: body.differencesText ?? '',
        enhancementOpportunitiesText: body.enhancementOpportunitiesText ?? '',
        keyTakeawaysText: body.keyTakeawaysText ?? '',
      },
      update: {
        ...(body.positioning !== undefined && { positioning: body.positioning }),
        ...(body.similaritiesText !== undefined && { similaritiesText: body.similaritiesText }),
        ...(body.differencesText !== undefined && { differencesText: body.differencesText }),
        ...(body.enhancementOpportunitiesText !== undefined && { enhancementOpportunitiesText: body.enhancementOpportunitiesText }),
        ...(body.keyTakeawaysText !== undefined && { keyTakeawaysText: body.keyTakeawaysText }),
      },
      include: { ourFeature: true, competitor: true },
    })

    return NextResponse.json(comparison)
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
