import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { BattleCardsClient } from './_client'

export default async function BattleCardsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const [battleCards, ourFeatures, competitors] = await Promise.all([
    prisma.battleCard.findMany({
      where: { organizationId: orgId, productId },
      include: {
        ourFeature: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.ourFeature.findMany({
      where: { productId },
      orderBy: { name: 'asc' },
    }),
    prisma.competitor.findMany({
      where: { organizationId: orgId, productId },
      select: {
        id: true,
        name: true,
        reportStatus: true,
        lastReportAt: true,
        _count: { select: { managedSources: true, features: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <BattleCardsClient
      battleCards={battleCards as any}
      ourFeatures={ourFeatures}
      competitors={competitors}
      orgId={orgId}
    />
  )
}
