import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { PromptsClient } from './_client'

export default async function PromptsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const prompts = await prisma.prompt.findMany({
    where: { organizationId: orgId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return <PromptsClient prompts={prompts} orgId={orgId} />
}
