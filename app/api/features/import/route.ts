import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const STATUS_VALUES = ['AVAILABLE', 'PLANNED', 'DEPRECATED', 'IN_REVIEW'] as const

const importRecordSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  category: z.string().optional().default('General'),
  status: z.preprocess(
    (v) => typeof v === 'string' ? v.toUpperCase() : v,
    z.enum(STATUS_VALUES).optional().default('AVAILABLE')
  ),
  tags: z.union([z.array(z.string()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
  build: z.string().optional(),
  owner: z.string().optional(),
  coverImageUrl: z.string().optional(),
  targetUsers: z.string().optional().default(''),
  valueProposition: z.string().optional().default(''),
  platform: z.string().optional(),
  maturityLevel: z.string().optional().default('GA'),
  isCustomerFacing: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  docsLinks: z.union([z.array(z.any()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
  setupLinks: z.union([z.array(z.any()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
  designFiles: z.union([z.array(z.any()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
  releaseNotes: z.string().optional().default(''),
  competitorMappings: z.union([z.array(z.any()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
  configDetails: z.string().optional().default(''),
  useCases: z.string().optional().default(''),
  metadata: z.record(z.unknown()).optional().transform((v) => v ? JSON.stringify(v) : '{}'),
  introducedInBuild: z.string().optional(),
  updatedInBuild: z.string().optional(),
  changelog: z.union([z.array(z.any()), z.string()]).optional().transform((v) => {
    if (!v) return '[]'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  }),
})

export async function POST(req: Request) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.organizationId
  const body = await req.json()
  const { records, productId } = body

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records must be a non-empty array' }, { status: 400 })
  }

  // Resolve product
  let resolvedProductId = productId
  if (!resolvedProductId) {
    const firstProduct = await prisma.product.findFirst({ where: { organizationId: orgId } })
    if (!firstProduct) {
      // Auto-create
      const created = await prisma.product.create({
        data: { organizationId: orgId, name: 'My Product' },
      })
      resolvedProductId = created.id
    } else {
      resolvedProductId = firstProduct.id
    }
  } else {
    const product = await prisma.product.findFirst({ where: { id: resolvedProductId, organizationId: orgId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const results = { created: 0, failed: 0, errors: [] as { index: number; name: string; error: string }[] }

  for (let i = 0; i < records.length; i++) {
    const raw = records[i]
    const parsed = importRecordSchema.safeParse(raw)
    if (!parsed.success) {
      results.failed++
      results.errors.push({ index: i, name: raw?.name ?? `row ${i + 1}`, error: parsed.error.issues[0]?.message ?? 'Validation failed' })
      continue
    }

    const d = parsed.data
    try {
      await (prisma.ourFeature.create as any)({
        data: {
          productId: resolvedProductId,
          name: d.name,
          description: d.description,
          category: d.category,
          status: d.status,
          tags: d.tags,
          build: d.build,
          owner: d.owner,
          coverImageUrl: d.coverImageUrl,
          targetUsers: d.targetUsers,
          valueProposition: d.valueProposition,
          platform: d.platform,
          maturityLevel: d.maturityLevel,
          isCustomerFacing: d.isCustomerFacing,
          isFeatured: d.isFeatured,
          docsLinks: d.docsLinks,
          setupLinks: d.setupLinks,
          designFiles: d.designFiles,
          releaseNotes: d.releaseNotes,
          competitorMappings: d.competitorMappings,
          configDetails: d.configDetails,
          useCases: d.useCases,
          metadataJson: d.metadata,
          introducedInBuild: d.introducedInBuild,
          updatedInBuild: d.updatedInBuild,
          changelogJson: d.changelog,
        },
      })
      results.created++
    } catch (e: any) {
      results.failed++
      results.errors.push({ index: i, name: d.name, error: e?.message ?? 'DB error' })
    }
  }

  revalidatePath('/features')
  return NextResponse.json(results)
}
