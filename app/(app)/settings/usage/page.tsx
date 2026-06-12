import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { UsageClient } from './_client'

export default async function UsagePage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const logs = await prisma.promptExecutionLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { prompt: { select: { name: true, category: true } } },
  })

  return <UsageClient logs={logs} />
}
