import { requireOrgSession } from '@/lib/auth/utils'
import { IntegrationsClient } from './_client'

export default async function IntegrationsPage() {
  await requireOrgSession()
  return <IntegrationsClient />
}
