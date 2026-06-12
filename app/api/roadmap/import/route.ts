import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { computeRICEScore } from '@/lib/utils'

const rowSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  category: z.string().optional().default('General'),
  status: z.string().optional().default('PROPOSED'),
  targetQuarter: z.string().optional().default(''),
  jiraKey: z.string().optional().default(''),
  riceReach: z.number().optional().default(0),
  riceImpact: z.number().optional().default(0),
  riceConfidence: z.number().optional().default(0),
  riceEffort: z.number().optional().default(1),
})

const importSchema = z.object({
  productId: z.string(),
  jobId: z.string().optional(),
  rows: z.array(rowSchema),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = importSchema.parse(await req.json())

    const product = await prisma.product.findFirst({
      where: { id: body.productId, organizationId: orgId },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const max = await prisma.roadmapItem.aggregate({
      where: { productId: body.productId },
      _max: { sortOrder: true },
    })
    let sortBase = (max._max.sortOrder ?? 0) + 1

    const created = await Promise.all(
      body.rows.map(async (row, i) => {
        const validStatus = ['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'SHIPPED', 'DEFERRED'].includes(row.status)
          ? row.status
          : 'PROPOSED'
        const priorityScore = computeRICEScore(row.riceReach, row.riceImpact, row.riceConfidence, row.riceEffort)
        const item = await prisma.roadmapItem.create({
          data: {
            productId: body.productId,
            title: row.title,
            description: row.description,
            category: row.category,
            status: validStatus,
            targetQuarter: row.targetQuarter || null,
            jiraKey: row.jiraKey || null,
            riceReach: row.riceReach,
            riceImpact: row.riceImpact,
            riceConfidence: row.riceConfidence,
            riceEffort: row.riceEffort,
            priorityScore,
            sortOrder: sortBase + i,
            sourceType: 'UPLOADED_DOC',
            specStatus: 'NO_SPEC',
          },
        })
        await prisma.roadmapActivity.create({
          data: {
            roadmapItemId: item.id,
            eventType: 'item_imported',
            actorName: 'Import',
            actorType: 'SYSTEM',
            metadataJson: JSON.stringify({ jobId: body.jobId, originalTitle: row.title }),
          },
        })
        return item
      })
    )

    if (body.jobId) {
      await prisma.importJob.update({
        where: { id: body.jobId },
        data: { status: 'COMPLETED', importedCount: created.length, completedAt: new Date() },
      })
    }

    return NextResponse.json({ imported: created.length, items: created }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
