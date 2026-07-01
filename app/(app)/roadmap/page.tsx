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

  // AUDIT P0-3: prototype fields are columns on RoadmapItem and returned by the
  // typed findMany below — the separate raw-SQL query + merge is no longer needed.
  const [items, llmConfigs] = await Promise.all([
    prisma.roadmapItem.findMany({
      where: { productId, isAiSuggested: false, isDraft: false, dismissedAt: null },
      include: { spec: { select: { id: true, version: true, lifecycleState: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.lLMConfig.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, label: true, provider: true, defaultModel: true },
    }),
  ])

  return <RoadmapClient initialItems={items as any} products={products} llmConfigs={llmConfigs} />
}
