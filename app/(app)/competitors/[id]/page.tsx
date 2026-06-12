import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CompetitorDetailClient } from './_client'

export default async function CompetitorDetailPage({ params }: { params: { id: string } }) {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId

  const competitor = await prisma.competitor.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      features: {
        include: { sourceEvidence: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      },
      keyUpdates: {
        orderBy: { detectedAt: 'desc' },
        take: 50,
      },
      battleCards: true,
      managedSources: {
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          confidenceOverall: true,
          evidenceCount: true,
          sourceCount: true,
          generatedAt: true,
          modelUsed: true,
          executiveSummary: true,
          createdAt: true,
        },
      },
    },
  })
  if (!competitor) notFound()

  return <CompetitorDetailClient competitor={competitor as any} />
}
