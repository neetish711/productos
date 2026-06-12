import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const card = await prisma.battleCard.findFirst({ where: { id: params.id, organizationId: orgId }, include: { ourFeature: true, competitors: true } })
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(card)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.battleCard.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    const updated = await prisma.battleCard.update({ where: { id: params.id }, data: body })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.battleCard.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.battleCard.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
