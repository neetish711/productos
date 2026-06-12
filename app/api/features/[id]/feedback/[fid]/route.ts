import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function resolve(fid: string, featureId: string, orgId: string) {
  const f = await (prisma as any).featureFeedback.findFirst({ where: { id: fid, featureId } })
  if (!f) return null
  const feature = await prisma.ourFeature.findFirst({
    where: { id: featureId, product: { organizationId: orgId } }, select: { id: true },
  })
  return feature ? f : null
}

export async function PATCH(req: Request, { params }: { params: { id: string; fid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const f = await resolve(params.fid, params.id, session.user.organizationId)
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status, title, content, type } = await req.json()
  const updated = await (prisma as any).featureFeedback.update({
    where: { id: params.fid },
    data: {
      ...(status ? { status } : {}),
      ...(title ? { title: title.trim() } : {}),
      ...(content !== undefined ? { content: content.trim() } : {}),
      ...(type ? { type } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: { id: string; fid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const f = await resolve(params.fid, params.id, session.user.organizationId)
  if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await (prisma as any).featureFeedback.delete({ where: { id: params.fid } })
  return NextResponse.json({ ok: true })
}
