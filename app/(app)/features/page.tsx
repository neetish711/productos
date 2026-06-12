import { requireOrgSession } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { getOurFeatures, getProducts } from '@/lib/db/queries/features'
import { FeaturesClient } from './_components/features-client'

export default async function FeaturesPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const [features, products] = await Promise.all([
    getOurFeatures(orgId, productId),
    getProducts(orgId),
  ])

  return <FeaturesClient features={features} products={products} orgId={orgId} />
}
