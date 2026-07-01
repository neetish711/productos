'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// AUDIT P0-3: These fields are all declared on the OurFeature model, so they are
// written/read through the typed Prisma client. The previous raw-SQL shim existed
// only to work around a stale Prisma client on Windows dev and used SQLite-only
// `?` placeholders + boolean-as-0/1, both of which break on PostgreSQL.

export async function getOurFeatures(orgId: string, productId?: string) {
  const rows = await prisma.ourFeature.findMany({
    where: { product: { organizationId: orgId }, ...(productId ? { productId } : {}) },
    include: { product: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(({ product, ...f }) => ({ ...f, productName: product.name }))
}

export async function getOurFeature(id: string, orgId: string) {
  const feature = await prisma.ourFeature.findFirst({
    where: { id, product: { organizationId: orgId } },
    include: { comparisons: { include: { competitor: true } } },
  })
  return feature
}

const intelligenceFields = {
  build: z.string().optional(),
  owner: z.string().optional(),
  coverImageUrl: z.string().optional(),
  targetUsers: z.string().default(''),
  valueProposition: z.string().default(''),
  platform: z.string().optional(),
  maturityLevel: z.string().default('GA'),
  isCustomerFacing: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  docsLinks: z.string().default('[]'),
  setupLinks: z.string().default('[]'),
  designFiles: z.string().default('[]'),
  releaseNotes: z.string().default(''),
  competitorMappings: z.string().default('[]'),
  configDetails: z.string().default(''),
  useCases: z.string().default(''),
  metadataJson: z.string().default('{}'),
  introducedInBuild: z.string().optional(),
  updatedInBuild: z.string().optional(),
  changelogJson: z.string().default('[]'),
}

const createSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('General'),
  status: z.enum(['AVAILABLE', 'PLANNED', 'DEPRECATED', 'IN_REVIEW']).default('AVAILABLE'),
  tags: z.string().default('[]'),
  ...intelligenceFields,
})

export async function createOurFeature(orgId: string, data: z.infer<typeof createSchema>) {
  const parsed = createSchema.parse(data)

  // Ensure product exists for this org; auto-create default product if none
  let product = await prisma.product.findFirst({ where: { id: parsed.productId, organizationId: orgId } })
  if (!product) {
    // Try any product for this org
    const anyProduct = await prisma.product.findFirst({ where: { organizationId: orgId } })
    if (anyProduct) {
      product = anyProduct
    } else {
      // Auto-create a default product
      product = await prisma.product.create({
        data: { organizationId: orgId, name: 'My Product', description: 'Default product' },
      })
    }
  }

  // AUDIT P0-3: write base + intelligence fields in one typed create.
  const { productId: _ignored, ...featureData } = parsed
  const feature = await prisma.ourFeature.create({
    data: { ...featureData, productId: product.id },
  })

  revalidatePath('/features')
  return feature
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['AVAILABLE', 'PLANNED', 'DEPRECATED', 'IN_REVIEW']).optional(),
  tags: z.string().optional(),
  build: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  targetUsers: z.string().optional(),
  valueProposition: z.string().optional(),
  platform: z.string().nullable().optional(),
  maturityLevel: z.string().optional(),
  isCustomerFacing: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  docsLinks: z.string().optional(),
  setupLinks: z.string().optional(),
  designFiles: z.string().optional(),
  releaseNotes: z.string().optional(),
  competitorMappings: z.string().optional(),
  configDetails: z.string().optional(),
  useCases: z.string().optional(),
  metadataJson: z.string().optional(),
  introducedInBuild: z.string().nullable().optional(),
  updatedInBuild: z.string().nullable().optional(),
  changelogJson: z.string().optional(),
})

export async function updateOurFeature(id: string, orgId: string, data: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.parse(data)
  const existing = await prisma.ourFeature.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Feature not found')

  // AUDIT P0-3: single typed update covering base + intelligence fields.
  // updateSchema only permits known columns, so spreading defined keys is safe.
  const updateData = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== undefined),
  )
  if (Object.keys(updateData).length > 0) {
    await prisma.ourFeature.update({ where: { id }, data: updateData })
  }

  revalidatePath('/features')
  return { id, ...parsed }
}

export async function deleteOurFeature(id: string, orgId: string) {
  const existing = await prisma.ourFeature.findFirst({ where: { id, product: { organizationId: orgId } } })
  if (!existing) throw new Error('Feature not found')
  await prisma.ourFeature.delete({ where: { id } })
  revalidatePath('/features')
}

export async function bulkDeleteOurFeatures(ids: string[], orgId: string) {
  await prisma.ourFeature.deleteMany({
    where: { id: { in: ids }, product: { organizationId: orgId } },
  })
  revalidatePath('/features')
}

export async function getProducts(orgId: string) {
  return prisma.product.findMany({ where: { organizationId: orgId } })
}
