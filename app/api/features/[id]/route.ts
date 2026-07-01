import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    // AUDIT P0-3: typed Prisma (was SQLite-only `?` raw SQL).
    const feature = await prisma.ourFeature.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
    })
    if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(feature)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['AVAILABLE', 'PLANNED', 'DEPRECATED', 'IN_REVIEW']).optional(),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const feature = await prisma.ourFeature.findFirst({ where: { id: params.id, product: { organizationId: orgId } } })
    if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = updateSchema.parse(await req.json())
    const updated = await prisma.ourFeature.update({ where: { id: params.id }, data: body })
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const feature = await prisma.ourFeature.findFirst({ where: { id: params.id, product: { organizationId: orgId } } })
    if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.ourFeature.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
