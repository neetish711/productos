import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { SettingsClient } from './_client'

export default async function SettingsPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const [org, users] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return <SettingsClient org={org!} users={users} currentUserId={session.user.id} />
}
