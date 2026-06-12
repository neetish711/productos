import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// GET /api/competitors/[id]/reports
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const reports = await prisma.competitorReport.findMany({
      where: { competitorId: params.id, organizationId: orgId },
      include: {
        versions: { select: { id: true, version: true, createdAt: true }, orderBy: { version: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(reports)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}
