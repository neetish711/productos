import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// GET /api/competitors/[id]/sources
// Returns all SourceEvidence for all features of this competitor
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const features = await prisma.competitorFeature.findMany({
      where: { competitorId: params.id },
      include: { sourceEvidence: { orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    })

    const sources = features.flatMap((f) =>
      f.sourceEvidence.map((s) => ({
        ...s,
        featureId: f.id,
        featureName: f.name,
      }))
    )
    return NextResponse.json(sources)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const createSchema = z.object({
  featureId: z.string(),
  url: z.string().url('Must be a valid URL'),
  title: z.string().default(''),
  snippet: z.string().default(''),
  sourceType: z.string().default('webpage'),
  confidence: z.number().min(0).max(1).default(0.8),
})

// POST /api/competitors/[id]/sources
// Creates a new SourceEvidence on a feature belonging to this competitor
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = createSchema.parse(await req.json())

    // Validate featureId belongs to this competitor
    const feature = await prisma.competitorFeature.findFirst({
      where: { id: body.featureId, competitorId: params.id },
    })
    if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })

    const source = await prisma.sourceEvidence.create({
      data: {
        competitorFeatureId: body.featureId,
        url: body.url,
        title: body.title,
        snippet: body.snippet,
        sourceType: body.sourceType,
        confidence: body.confidence,
      },
    })
    return NextResponse.json({ ...source, featureId: feature.id, featureName: feature.name }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
