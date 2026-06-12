import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

async function checkAccess(featureId: string, orgId: string) {
  return prisma.ourFeature.findFirst({
    where: { id: featureId, product: { organizationId: orgId } },
    select: { id: true },
  })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkAccess(params.id, session.user.organizationId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const solutions = await (prisma as any).featureSolution.findMany({
    where: { featureId: params.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(solutions)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkAccess(params.id, session.user.organizationId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { title, content, type, tags } = await req.json()
  if (!title?.trim() || !content?.trim())
    return NextResponse.json({ error: 'Title and content required' }, { status: 400 })

  const solution = await (prisma as any).featureSolution.create({
    data: {
      featureId: params.id,
      title: title.trim(),
      content: content.trim(),
      type: type ?? 'FAQ',
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
    },
  })
  return NextResponse.json(solution)
}
