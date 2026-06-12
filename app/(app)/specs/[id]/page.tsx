import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { SpecWorkspaceClient } from './_client'

export default async function SpecDetailPage({ params }: { params: { id: string } }) {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const [spec, llmConfigs] = await Promise.all([
    prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      include: {
        roadmapItem: true,
        versions: {
          orderBy: { version: 'desc' },
          include: {
            changedBy: { select: { name: true } },
            _count: { select: { comments: true } },
          },
        },
      },
    }),
    prisma.lLMConfig.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, label: true, provider: true, defaultModel: true },
    }),
  ])

  if (!spec) notFound()

  return (
    <SpecWorkspaceClient
      spec={spec as any}
      userId={session.user.id}
      userName={session.user.name as any}
      userRole={session.user.role}
      llmConfigs={llmConfigs}
    />
  )
}
