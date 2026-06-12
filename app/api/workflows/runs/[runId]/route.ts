import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { runId: string } }) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const run = await prisma.workflowRun.findFirst({
    where: { id: params.runId, organizationId: session.user.organizationId },
    include: {
      steps: { orderBy: { stepIndex: 'asc' } },
    },
  })

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Parse step output JSON
  const steps = run.steps.map((s) => {
    let output: any = {}
    try { output = JSON.parse((s as any).outputJson || '{}') } catch { /* ignore */ }
    return {
      id: s.id,
      name: s.stepName,
      index: s.stepIndex,
      status: s.status,
      tokensUsed: s.tokensUsed,
      output,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    }
  })

  return NextResponse.json({
    id: run.id,
    type: run.workflowType,
    status: run.status,
    totalTokens: run.totalTokens,
    estimatedCost: run.estimatedCost,
    errorMessage: run.errorMessage,
    params: (() => { try { return JSON.parse(run.inputParamsJson) } catch { return {} } })(),
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    steps,
  })
}
