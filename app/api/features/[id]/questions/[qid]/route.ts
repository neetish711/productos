import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
function nanoid(n = 8) { return Math.random().toString(36).slice(2, 2 + n) }

async function resolveQuestion(qid: string, featureId: string, orgId: string) {
  const q = await (prisma as any).featureQuestion.findFirst({
    where: { id: qid, featureId },
  })
  if (!q) return null
  const feature = await prisma.ourFeature.findFirst({
    where: { id: featureId, product: { organizationId: orgId } },
    select: { id: true },
  })
  return feature ? q : null
}

export async function DELETE(_req: Request, { params }: { params: { id: string; qid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = await resolveQuestion(params.qid, params.id, session.user.organizationId)
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await (prisma as any).featureQuestion.delete({ where: { id: params.qid } })
  return NextResponse.json({ ok: true })
}

// POST /questions/[qid] — add an answer
export async function POST(req: Request, { params }: { params: { id: string; qid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = await resolveQuestion(params.qid, params.id, session.user.organizationId)
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { content, answeredBy, isBest, isApproved } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Answer required' }, { status: 400 })

  const answers = JSON.parse(q.answersJson ?? '[]')
  const newAnswer = {
    id: nanoid(8),
    content: content.trim(),
    answeredBy: answeredBy?.trim() || 'Anonymous',
    isBest: !!isBest,
    isApproved: !!isApproved,
    createdAt: new Date().toISOString(),
  }
  answers.push(newAnswer)

  const hasApproved = answers.some((a: any) => a.isApproved || a.isBest)
  await (prisma as any).featureQuestion.update({
    where: { id: params.qid },
    data: {
      answersJson: JSON.stringify(answers),
      status: hasApproved ? 'ANSWERED' : q.status,
    },
  })
  return NextResponse.json(newAnswer)
}

// PATCH /questions/[qid] — mark answer as best / update status
export async function PATCH(req: Request, { params }: { params: { id: string; qid: string } }) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const q = await resolveQuestion(params.qid, params.id, session.user.organizationId)
  if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { bestAnswerId, status } = await req.json()
  const answers = JSON.parse(q.answersJson ?? '[]')

  if (bestAnswerId) {
    for (const a of answers) {
      a.isBest = a.id === bestAnswerId
      if (a.isBest) a.isApproved = true
    }
  }

  await (prisma as any).featureQuestion.update({
    where: { id: params.qid },
    data: {
      answersJson: JSON.stringify(answers),
      ...(status ? { status } : {}),
      ...(bestAnswerId ? { status: 'ANSWERED' } : {}),
    },
  })
  return NextResponse.json({ ok: true })
}
