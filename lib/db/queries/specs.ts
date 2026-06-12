'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getSpecs(orgId: string) {
  const products = await prisma.product.findMany({ where: { organizationId: orgId } })
  const productIds = products.map((p) => p.id)
  const roadmapItems = await prisma.roadmapItem.findMany({
    where: { productId: { in: productIds }, spec: { isNot: null } },
    include: { spec: { include: { _count: { select: { versions: true } } } } },
  })
  return roadmapItems.map((ri) => ri.spec!).filter(Boolean)
}

export async function getSpec(id: string, orgId: string) {
  const spec = await prisma.spec.findFirst({
    where: {
      id,
      roadmapItem: { product: { organizationId: orgId } },
    },
    include: {
      versions: { orderBy: { version: 'desc' } },
      roadmapItem: true,
    },
  })
  return spec
}

export async function createSpec(orgId: string, data: {
  roadmapItemId?: string
  title: string
  contentMd: string
  generationMethod?: 'AI_GENERATED' | 'MANUAL' | 'AI_IMPROVED' | 'VOICE_TO_SPEC' | 'DOC_TO_SPEC'
}) {
  if (data.roadmapItemId) {
    const item = await prisma.roadmapItem.findFirst({
      where: { id: data.roadmapItemId, product: { organizationId: orgId } },
    })
    if (!item) throw new Error('Roadmap item not found')
  }

  const spec = await prisma.spec.create({
    data: {
      roadmapItemId: data.roadmapItemId,
      title: data.title,
      contentMd: data.contentMd,
      generationMethod: data.generationMethod ?? 'MANUAL',
      version: 1,
    },
  })

  // Save initial version
  await prisma.specVersion.create({
    data: { specId: spec.id, version: 1, contentMd: data.contentMd, changeSummary: 'Initial version' },
  })

  revalidatePath('/specs')
  if (data.roadmapItemId) revalidatePath('/roadmap')
  return spec
}

export async function updateSpecContent(id: string, orgId: string, contentMd: string, userId?: string, changeSummary?: string) {
  const spec = await prisma.spec.findFirst({
    where: { id, roadmapItem: { product: { organizationId: orgId } } },
  })
  if (!spec) throw new Error('Spec not found')

  const newVersion = spec.version + 1
  const [updatedSpec] = await prisma.$transaction([
    prisma.spec.update({ where: { id }, data: { contentMd, version: newVersion } }),
    prisma.specVersion.create({
      data: {
        specId: id,
        version: newVersion,
        contentMd,
        changedByUserId: userId,
        changeSummary: changeSummary ?? 'Manual edit',
      },
    }),
  ])

  revalidatePath(`/specs/${id}`)
  return updatedSpec
}

export async function deleteSpec(id: string, orgId: string) {
  const spec = await prisma.spec.findFirst({
    where: { id, roadmapItem: { product: { organizationId: orgId } } },
  })
  if (!spec) throw new Error('Spec not found')
  await prisma.spec.delete({ where: { id } })
  revalidatePath('/specs')
}

export async function getSpecVersions(specId: string, orgId: string) {
  const spec = await prisma.spec.findFirst({
    where: { id: specId, roadmapItem: { product: { organizationId: orgId } } },
  })
  if (!spec) throw new Error('Spec not found')
  return prisma.specVersion.findMany({
    where: { specId },
    include: { changedBy: { select: { name: true, email: true } } },
    orderBy: { version: 'desc' },
  })
}
