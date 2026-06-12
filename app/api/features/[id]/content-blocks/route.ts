import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function resolveFeature(id: string, orgId: string) {
  const rows = await prisma.$queryRawUnsafe<{ id: string; contentBlocksJson: string }[]>(
    `SELECT f.id, f."contentBlocksJson" FROM "OurFeature" f
     JOIN "Product" p ON p.id = f."productId"
     WHERE f.id = ? AND p."organizationId" = ?`,
    id, orgId
  )
  return rows[0] ?? null
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

  await prisma.$executeRawUnsafe(
    `UPDATE "OurFeature" SET "contentBlocksJson" = ? WHERE "id" = ?`,
    JSON.stringify(blocks),
    params.id
  )
  return NextResponse.json({ ok: true })
}
