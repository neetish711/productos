import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export async function GET() {
  try {
    const orgId = await getOrgId()
    const products = await prisma.product.findMany({ where: { organizationId: orgId } })
    return NextResponse.json(products)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = z.object({ name: z.string().min(1), description: z.string().default('') }).parse(await req.json())
    const product = await prisma.product.create({ data: { ...body, organizationId: orgId } })
    return NextResponse.json(product, { status: 201 })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
