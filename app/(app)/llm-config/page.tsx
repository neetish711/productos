import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { LLMConfigClient } from './_client'

export default async function LLMConfigPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const configs = await prisma.lLMConfig.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      label: true,
      defaultModel: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      // Never expose encrypted key
    },
  })

  return <LLMConfigClient configs={configs} orgId={orgId} />
}
