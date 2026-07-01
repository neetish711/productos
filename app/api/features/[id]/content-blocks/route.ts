import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function resolveFeature(id: string, orgId: string) {
  // AUDIT P0-3: typed Prisma (was SQLite-only `?` raw SQL).
  return prisma.ourFeature.findFirst({
    where: { id, product: { organizationId: orgId } },
    select: { id: true, contentBlocksJson: true },
  })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const feature = await resolveFeature(params.id, session.user.organizationId)
  if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const blocks = JSON.parse(feature.contentBlocksJson ?? '[]')
    return NextResponse.json(blocks)
  } catch {
    return NextResponse.json([])
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const feature = await resolveFeature(params.id, session.user.organizationId)
  if (!feature) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const blocks = await req.json()
  if (!Array.isArray(blocks)) return NextResponse.json({ error: 'Expected array' }, { status: 400 })

  // AUDIT P0-3: typed Prisma (was SQLite-only `?` raw SQL).
  await prisma.ourFeature.update({
    where: { id: params.id },
    data: { contentBlocksJson: JSON.stringify(blocks) },
  })
  return NextResponse.json({ ok: true })
}
