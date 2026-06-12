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

  const questions = await (prisma as any).featureQuestion.findMany({
    where: { featureId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(questions)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkAccess(params.id, session.user.organizationId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { question, askedBy } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 })

  const q = await (prisma as any).featureQuestion.create({
    data: {
      featureId: params.id,
      question: question.trim(),
      askedBy: askedBy?.trim() || 'Anonymous',
    },
  })
  return NextResponse.json(q)
}
