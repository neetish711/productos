import { requireOrgSession } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { getKeyUpdates } from '@/lib/db/queries/competitors'
import { KeyUpdatesClient } from './_client'

export default async function KeyUpdatesPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const updates = await getKeyUpdates(orgId, productId)

  return <KeyUpdatesClient updates={updates as any} />
}
