import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { resolveProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = await resolveProductIdFromRequest(req)
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, ...(productId ? { OR: [{ productId }, { productId: null }] } : {}) },
      include: { _count: { select: { updates: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const schema = z.object({
  name: z.string().min(1),
  healthStatus: z.enum(['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED']).default('NEW'),
  csmName: z.string().default(''),
  // AUDIT S4-email: validate format while still allowing empty/omitted.
  csmEmail: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  meetingCadence: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).default('MONTHLY'),
  notesText: z.string().default(''),
  risksText: z.string().default(''),
  openAsksText: z.string().default(''),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const raw = await req.json()
    const body = schema.parse(raw)
    // AUDIT P0-4: verify the body/cookie productId belongs to the user before stamping it.
    const productId = await resolveProductIdFromRequest(req, raw.productId)
    const account = await prisma.account.create({ data: { ...body, organizationId: orgId, ...(productId ? { productId } : {}) } })
    return NextResponse.json(account, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
