import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { RoadmapClient } from './_client'

export default async function RoadmapPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const products = await prisma.product.findMany({ where: { organizationId: orgId } })

  const [items, protoFields, llmConfigs] = await Promise.all([
    prisma.roadmapItem.findMany({
      where: { productId, isAiSuggested: false, isDraft: false, dismissedAt: null },
      include: { spec: { select: { id: true, version: true, lifecycleState: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    // Fetch prototype fields via raw SQL (not yet in ORM runtime)
    prisma.$queryRawUnsafe<{ id: string; prototypeStatus: string; lovableProjectUrl: string | null; githubRepoUrl: string | null; githubBranch: string | null }[]>(
      `SELECT id, prototypeStatus, lovableProjectUrl, githubRepoUrl, githubBranch FROM RoadmapItem WHERE productId = ?`,
      productId,
    ),
    prisma.lLMConfig.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, label: true, provider: true, defaultModel: true },
    }),
  ])

  // Merge prototype fields into items
  const protoMap = new Map((protoFields as any[]).map((r: any) => [r.id, r]))
  const enriched = items.map(item => ({
    ...item,
    prototypeStatus:  (protoMap.get(item.id) as any)?.prototypeStatus ?? 'NONE',
    lovableProjectUrl:(protoMap.get(item.id) as any)?.lovableProjectUrl ?? null,
    githubRepoUrl:    (protoMap.get(item.id) as any)?.githubRepoUrl ?? null,
    githubBranch:     (protoMap.get(item.id) as any)?.githubBranch ?? null,
  }))

  return <RoadmapClient initialItems={enriched as any} products={products} llmConfigs={llmConfigs} />
}
