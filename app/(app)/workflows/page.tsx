import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { WorkflowsClient } from './_client'

export default async function WorkflowsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const [runs, competitors] = await Promise.all([
    prisma.workflowRun.findMany({
      where: { organizationId: orgId, status: { in: ['RUNNING', 'PENDING'] } },
      include: {
        steps: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.competitor.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return <WorkflowsClient runs={runs as any} competitors={competitors} />
}
