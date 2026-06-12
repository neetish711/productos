import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const account = await prisma.account.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updates = await prisma.accountUpdate.findMany({ where: { accountId: params.id }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(updates)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const schema = z.object({
  summaryText: z.string().default(''),
  feedbackText: z.string().default(''),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED']).default('NEUTRAL'),
  urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
  sourceType: z.enum(['MANUAL', 'CHAT_INTEGRATION', 'CSM_INPUT', 'IMPORTED_REPORT']).default('MANUAL'),
  featureRequestsJson: z.array(z.string()).default([]),
  issuesJson: z.array(z.string()).default([]),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const account = await prisma.account.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = schema.parse(await req.json())
    const update = await prisma.accountUpdate.create({ data: { accountId: params.id, ...body } as any })
    return NextResponse.json(update, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
