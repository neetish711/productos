import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// GET /api/competitors/[id]/reports/[reportId]
export async function GET(
  _: Request,
  { params }: { params: { id: string; reportId: string } }
) {
  try {
    const orgId = await getOrgId()
    const report = await prisma.competitorReport.findFirst({
      where: { id: params.reportId, competitorId: params.id, organizationId: orgId },
      include: {
        versions: { orderBy: { version: 'desc' } },
      },
    })
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(report)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

// DELETE /api/competitors/[id]/reports/[reportId]
export async function DELETE(
  _: Request,
  { params }: { params: { id: string; reportId: string } }
) {
  try {
    const orgId = await getOrgId()
    const report = await prisma.competitorReport.findFirst({
      where: { id: params.reportId, competitorId: params.id, organizationId: orgId },
    })
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.competitorReport.delete({ where: { id: params.reportId } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Error deleting report' }, { status: 500 }) }
}
