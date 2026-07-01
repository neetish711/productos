import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
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

  // AUDIT S3-1: derive review capability from real permissions (server-side),
  // not a hardcoded role list containing roles that don't exist in this system.
  const perms = (session.user as any).permissions ?? []
  const canReview =
    hasPermission(session.user.role, perms, 'approve_story') ||
    hasPermission(session.user.role, perms, 'reject_story')
  const canSubmit = hasPermission(session.user.role, perms, 'submit_for_review')

  return (
    <SpecWorkspaceClient
      spec={spec as any}
      userId={session.user.id}
      userName={session.user.name as any}
      userRole={session.user.role}
      canReview={canReview}
      canSubmit={canSubmit}
      llmConfigs={llmConfigs}
    />
  )
}
