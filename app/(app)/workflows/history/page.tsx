import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { WorkflowHistoryClient } from './_client'

export default async function WorkflowHistoryPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const runs = await prisma.workflowRun.findMany({
    where: { organizationId: orgId },
    include: {
      steps: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return <WorkflowHistoryClient runs={runs as any} />
}
