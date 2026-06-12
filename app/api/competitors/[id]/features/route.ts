import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// GET /api/competitors/[id]/features
// Returns minimal feature list (id + name) for use in dropdowns
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const features = await prisma.competitorFeature.findMany({
      where: { competitorId: params.id },
      select: { id: true, name: true, category: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(features)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}
