'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { computeRICEScore } from '@/lib/utils'

export async function getRoadmapItems(orgId: string, aiSuggestedOnly = false) {
  const products = await prisma.product.findMany({ where: { organizationId: orgId } })
  const productIds = products.map((p) => p.id)
  return prisma.roadmapItem.findMany({
    where: { productId: { in: productIds }, isAiSuggested: aiSuggestedOnly, dismissedAt: null },
    include: { spec: { select: { id: true, version: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function getRoadmapItem(id: string, orgId: string) {
  const item = await prisma.roadmapItem.findFirst({
    where: { id, product: { organizationId: orgId } },
    include: { spec: true },
  })
  return item
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
  aiConfidence: z.number().optional(),
})

export async function createRoadmapItem(orgId: string, data: z.infer<typeof createSchema>) {
  const parsed = createSchema.parse(data)
  const product = await prisma.product.findFirst({ where: { id: parsed.productId, organizationId: orgId } })
  if (!product) throw new Error('Product not found')

  const priorityScore = computeRICEScore(parsed.riceReach, parsed.riceImpact, parsed.riceConfidence, parsed.riceEffort)

  // Get max sort order
  const maxOrder = await prisma.roadmapItem.aggregate({
    where: { productId: parsed.productId },
    _max: { sortOrder: true },
  })

  const item = await prisma.roadmapItem.create({
    data: { ...parsed, priorityScore, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  })
  revalidatePath('/roadmap')
  return item
}

export async function updateRoadmapItem(id: string, orgId: string, data: Partial<z.infer<typeof createSchema>>) {
  const existing = await prisma.roadmapItem.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Roadmap item not found')

  const reach = data.riceReach ?? existing.riceReach
  const impact = data.riceImpact ?? existing.riceImpact
  const confidence = data.riceConfidence ?? existing.riceConfidence
  const effort = data.riceEffort ?? existing.riceEffort
  const priorityScore = computeRICEScore(reach, impact, confidence, effort)

  const item = await prisma.roadmapItem.update({ where: { id }, data: { ...data, priorityScore } })
  revalidatePath('/roadmap')
  return item
}

export async function deleteRoadmapItem(id: string, orgId: string) {
  const existing = await prisma.roadmapItem.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Roadmap item not found')
  await prisma.roadmapItem.delete({ where: { id } })
  revalidatePath('/roadmap')
}

export async function reorderRoadmapItems(items: { id: string; sortOrder: number }[], orgId: string) {
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      prisma.roadmapItem.updateMany({
        where: { id, product: { organizationId: orgId } },
        data: { sortOrder },
      })
    )
  )
  revalidatePath('/roadmap')
}

export async function dismissAiSuggestion(id: string, orgId: string) {
  const existing = await prisma.roadmapItem.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Item not found')
  await prisma.roadmapItem.update({ where: { id }, data: { dismissedAt: new Date() } })
  revalidatePath('/roadmap/ai-suggested')
}

export async function promoteAiSuggestion(id: string, orgId: string) {
  const existing = await prisma.roadmapItem.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Item not found')
  const item = await prisma.roadmapItem.update({
    where: { id },
    data: { isAiSuggested: false },
  })
  revalidatePath('/roadmap')
  revalidatePath('/roadmap/ai-suggested')
  return item
}
