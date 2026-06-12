import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function checkAccess(featureId: string, orgId: string) {
  return prisma.ourFeature.findFirst({
    where: { id: featureId, product: { organizationId: orgId } }, select: { id: true },
  })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkAccess(params.id, session.user.organizationId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const feedback = await (prisma as any).featureFeedback.findMany({
    where: { featureId: params.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(feedback)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkAccess(params.id, session.user.organizationId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, content, type, submittedBy, tags } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const item = await (prisma as any).featureFeedback.create({
    data: {
      featureId: params.id,
      title: title.trim(),
      content: content?.trim() ?? '',
      type: type ?? 'IMPROVEMENT',
      submittedBy: submittedBy?.trim() || 'Anonymous',
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
    },
  })
  return NextResponse.json(item)
}
