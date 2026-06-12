import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { ComparisonsClient } from './_client'

export default async function ComparisonsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const [ourFeatures, competitors, competitorFeatures, comparisons] = await Promise.all([
    prisma.ourFeature.findMany({
      where: { productId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, description: true },
    }),
    prisma.competitor.findMany({
      where: { organizationId: orgId, productId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.competitorFeature.findMany({
      where: { competitor: { organizationId: orgId, productId } },
      orderBy: [{ competitorId: 'asc' }, { name: 'asc' }],
      include: { competitor: { select: { id: true, name: true } } },
    }),
    prisma.comparison.findMany({
      where: { ourFeature: { productId } },
      include: { ourFeature: { select: { id: true, name: true, category: true } }, competitor: { select: { id: true, name: true } } },
    }),
  ])

  return (
    <ComparisonsClient
      ourFeatures={ourFeatures}
      competitors={competitors}
      competitorFeatures={competitorFeatures as any}
      comparisons={comparisons as any}
    />
  )
}
