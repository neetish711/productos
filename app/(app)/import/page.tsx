import { requireOrgSession } from '@/lib/auth/utils'
import { ImportClient } from './_client'

export const metadata = { title: 'Import Data' }

export default async function ImportPage() {
  await requireOrgSession()
  return <ImportClient />
}
