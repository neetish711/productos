import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function resolve(sid: string, featureId: string, orgId: string) {
  const s = await (prisma as any).featureSolution.findFirst({ where: { id: sid, featureId } })
  if (!s) return null
  const feature = await prisma.ourFeature.findFirst({
    where: { id: featureId, product: { organizationId: orgId } }, select: { id: true },
  })
  return feature ? s : null
}

export async function PUT(req: Request, { params }: { params: { id: string; sid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const s = await resolve(params.sid, params.id, session.user.organizationId)
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, content, type, tags } = await req.json()
  const updated = await (prisma as any).featureSolution.update({
    where: { id: params.sid },
    data: {
      ...(title ? { title: title.trim() } : {}),
      ...(content !== undefined ? { content: content.trim() } : {}),
      ...(type ? { type } : {}),
      ...(tags ? { tags: JSON.stringify(Array.isArray(tags) ? tags : []) } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string; sid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const s = await resolve(params.sid, params.id, session.user.organizationId)
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await (prisma as any).featureSolution.delete({ where: { id: params.sid } })
  return NextResponse.json({ ok: true })
}
