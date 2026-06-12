'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Extended fields not known to the stale Prisma client — written/read via raw SQL
const EXTENDED_FIELDS = [
  'build', 'owner', 'coverImageUrl', 'targetUsers', 'valueProposition',
  'platform', 'maturityLevel', 'isCustomerFacing', 'isFeatured',
  'docsLinks', 'setupLinks', 'designFiles', 'releaseNotes',
  'competitorMappings', 'configDetails', 'useCases', 'metadataJson',
  'introducedInBuild', 'updatedInBuild', 'changelogJson', 'contentBlocksJson',
] as const

async function applyExtendedFields(id: string, data: Record<string, unknown>) {
  const entries = EXTENDED_FIELDS
    .filter((k) => k in data && data[k] !== undefined)
    .map((k) => [k, data[k]] as [string, unknown])
  if (entries.length === 0) return
  const setClauses = entries.map(([k]) => `"${k}" = ?`).join(', ')
  await prisma.$executeRawUnsafe(
    `UPDATE "OurFeature" SET ${setClauses} WHERE "id" = ?`,
    ...entries.map(([, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)),
    id
  )
}

export async function getOurFeatures(orgId: string, productId?: string) {
  // Use raw SQL so all columns (including new ones not in stale client) are returned
  if (productId) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT f.*, p.name as "productName"
      FROM "OurFeature" f
      JOIN "Product" p ON p.id = f."productId"
      WHERE p."organizationId" = ? AND f."productId" = ?
      ORDER BY f."updatedAt" DESC
    `, orgId, productId)
    return rows
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT f.*, p.name as "productName"
    FROM "OurFeature" f
    JOIN "Product" p ON p.id = f."productId"
    WHERE p."organizationId" = ?
    ORDER BY f."updatedAt" DESC
  `, orgId)
  return rows
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

  // Create with only base fields (stale client knows these)
  const feature = await prisma.ourFeature.create({
    data: {
      productId: product.id,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      status: parsed.status,
      tags: parsed.tags,
    },
  })

  // Apply extended fields via raw SQL
  await applyExtendedFields(feature.id, parsed)

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

  // Update base fields the stale client knows about
  const baseUpdate: Record<string, unknown> = {}
  if (parsed.name !== undefined) baseUpdate.name = parsed.name
  if (parsed.description !== undefined) baseUpdate.description = parsed.description
  if (parsed.category !== undefined) baseUpdate.category = parsed.category
  if (parsed.status !== undefined) baseUpdate.status = parsed.status
  if (parsed.tags !== undefined) baseUpdate.tags = parsed.tags

  if (Object.keys(baseUpdate).length > 0) {
    await prisma.ourFeature.update({ where: { id }, data: baseUpdate })
  }

  // Apply extended fields via raw SQL
  await applyExtendedFields(id, parsed)

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
