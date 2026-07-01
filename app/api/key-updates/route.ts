import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { resolveProductIdFromRequest } from '@/lib/product-context'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = await resolveProductIdFromRequest(req)
    const { searchParams } = new URL(req.url)
    const competitorId = searchParams.get('competitorId')
    const updates = await prisma.competitorKeyUpdate.findMany({
      where: { competitor: { organizationId: orgId, ...(productId ? { productId } : {}) }, ...(competitorId ? { competitorId } : {}) },
      include: { competitor: true },
      orderBy: { detectedAt: 'desc' },
    })
    return NextResponse.json(updates)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PATCH(req: Request) {
  try {
    const orgId = await getOrgId()
    const { id, pmActionStatus } = await req.json()
    const update = await prisma.competitorKeyUpdate.findFirst({ where: { id, competitor: { organizationId: orgId } } })
    if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await prisma.competitorKeyUpdate.update({ where: { id }, data: { pmActionStatus } })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

// AUDIT S4-keyupd: allow deleting a misclassified key update (org-scoped).
export async function DELETE(req: Request) {
  try {
    const orgId = await getOrgId()
    const { id } = await req.json()
    const update = await prisma.competitorKeyUpdate.findFirst({ where: { id, competitor: { organizationId: orgId } } })
    if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.competitorKeyUpdate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
