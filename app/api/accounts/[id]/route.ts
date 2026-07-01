import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// AUDIT P0-9: strict whitelist — never spread the raw request body into Prisma,
// which previously allowed reassigning organizationId/productId (tenant move).
const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  healthStatus: z.enum(['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED']).optional(),
  csmName: z.string().optional(),
  csmEmail: z.string().optional(),
  meetingCadence: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).optional(),
  notesText: z.string().optional(),
  risksText: z.string().optional(),
  openAsksText: z.string().optional(),
}).strict()

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const account = await prisma.account.findFirst({
      where: { id: params.id, organizationId: orgId },
      include: { updates: { orderBy: { createdAt: 'desc' } }, _count: { select: { updates: true } } },
    })
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(account)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.account.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = updateAccountSchema.parse(await req.json())
    const updated = await prisma.account.update({ where: { id: params.id }, data: body })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.account.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.account.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
