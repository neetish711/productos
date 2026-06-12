import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { AccountsClient } from './_client'

export default async function AccountsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, productId },
    include: { _count: { select: { updates: true } } },
    orderBy: { name: 'asc' },
  })
  return <AccountsClient initialAccounts={accounts} />
}
