import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'
import { computeRICEScore } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = getProductIdFromRequest(req)
    let productFilter: Record<string, unknown>
    if (productId) {
      productFilter = { productId }
    } else {
      const products = await prisma.product.findMany({ where: { organizationId: orgId } })
      const productIds = products.map((p: any) => p.id)
      productFilter = { productId: { in: productIds } }
    }
    const specs = await prisma.spec.findMany({
      where: { roadmapItem: productFilter },
      include: {
        roadmapItem: { select: { title: true, status: true, specStatus: true } },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(specs)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const createSchema = z.object({
  roadmapItemId: z.string().optional(),
  title: z.string().min(1),
  contentMd: z.string().default(''),
  generationMethod: z.enum(['AI_GENERATED', 'MANUAL', 'AI_IMPROVED', 'VOICE_TO_SPEC', 'DOC_TO_SPEC']).default('MANUAL'),
  templateType: z.string().default('FULL_PRD'),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = createSchema.parse(await req.json())

    if (body.roadmapItemId) {
      const item = await prisma.roadmapItem.findFirst({ where: { id: body.roadmapItemId, product: { organizationId: orgId } } })
      if (!item) return NextResponse.json({ error: 'Roadmap item not found' }, { status: 404 })
      // Check if spec already exists for this item
      const existing = await prisma.spec.findFirst({ where: { roadmapItemId: body.roadmapItemId } })
      if (existing) return NextResponse.json(existing)
    }

    const spec = await prisma.spec.create({
      data: {
        ...body,
        version: 1,
        lifecycleState: 'DRAFT',
        templateType: body.templateType,
      },
    })
    await prisma.specVersion.create({
      data: {
        specId: spec.id,
        version: 1,
        versionName: 'Version 1',
        contentMd: body.contentMd,
        changedByUserId: session.user.id,
        changeSummary: 'Initial version',
        generationMode: body.generationMethod === 'AI_GENERATED' ? 'FRESH_DRAFT' : 'MANUAL_EDIT',
      },
    })

    if (body.roadmapItemId) {
      await prisma.roadmapItem.update({
        where: { id: body.roadmapItemId },
        data: { specId: spec.id, specStatus: 'DRAFT' },
      })
      await prisma.roadmapActivity.create({
        data: { roadmapItemId: body.roadmapItemId, specId: spec.id, eventType: 'prd_generated', actorName: session.user.name, metadataJson: JSON.stringify({ method: body.generationMethod }) },
      })
    }

    return NextResponse.json(spec, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
