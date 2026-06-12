import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'
import { computeRICEScore } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = getProductIdFromRequest(req)
    const { searchParams } = new URL(req.url)
    const aiOnly = searchParams.get('ai') === 'true'
    const ideasOnly = searchParams.get('ideas') === 'true'
    let productFilter: Record<string, unknown>
    if (productId) {
      productFilter = { productId }
    } else {
      const products = await prisma.product.findMany({ where: { organizationId: orgId } })
      const productIds = products.map((p) => p.id)
      productFilter = { productId: { in: productIds } }
    }
    const where: Record<string, unknown> = { ...productFilter, dismissedAt: null }
    if (ideasOnly) {
      where.isDraft = true
    } else {
      where.isAiSuggested = aiOnly
      if (!aiOnly) where.isDraft = false
    }
    const items = await prisma.roadmapItem.findMany({
      where,
      include: { spec: { select: { id: true, version: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(items)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const createSchema = z.object({
  productId: z.string(),
  title: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('General'),
  sourceType: z.enum(['MANUAL', 'COMPETITOR_GAP', 'ACCOUNT_FEEDBACK', 'AI_GENERATED', 'UPLOADED_DOC', 'VOICE_INPUT']).default('MANUAL'),
  status: z.enum(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'SHIPPED', 'DEFERRED']).default('PROPOSED'),
  riceReach: z.number().default(0),
  riceImpact: z.number().default(0),
  riceConfidence: z.number().default(0),
  riceEffort: z.number().default(1),
  targetQuarter: z.string().optional(),
  voiceTranscriptText: z.string().optional(),
  isAiSuggested: z.boolean().default(false),
  aiRationale: z.string().optional(),
  isDraft: z.boolean().default(false),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = createSchema.parse(await req.json())
    const product = await prisma.product.findFirst({ where: { id: body.productId, organizationId: orgId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const priorityScore = computeRICEScore(body.riceReach, body.riceImpact, body.riceConfidence, body.riceEffort)
    const max = await prisma.roadmapItem.aggregate({ where: { productId: body.productId }, _max: { sortOrder: true } })
    const item = await prisma.roadmapItem.create({
      data: { ...body, priorityScore, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
