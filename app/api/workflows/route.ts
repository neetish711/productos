import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { runWorkflow, preflightCheck, getInFlightRun } from '@/lib/workflow-engine/engine'
import { competitorRefreshWorkflow } from '@/lib/workflow-engine/definitions/competitor-refresh'
import { competitorDeepAnalysisWorkflow } from '@/lib/workflow-engine/definitions/competitor-deep-analysis'
import { getServerSession } from 'next-auth'

export async function GET() {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runs = await prisma.workflowRun.findMany({
    where: { organizationId: session.user.organizationId },
    include: { steps: { orderBy: { stepIndex: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json(runs)
}

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workflowType, competitorId } = await req.json()
  const orgId = session.user.organizationId

  // Idempotency: return existing in-flight run
  const inFlight = await getInFlightRun(workflowType, orgId, competitorId)
  if (inFlight) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: inFlight.id },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    })
    return NextResponse.json({ ...run, alreadyRunning: true })
  }

  let definition = null
  if (workflowType === 'COMPETITOR_REFRESH') {
    definition = competitorRefreshWorkflow
  } else if (workflowType === 'COMPETITOR_DEEP_ANALYSIS') {
    if (!competitorId) {
      return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })
    }
    // Verify competitor belongs to org
    const competitor = await prisma.competitor.findFirst({
      where: { id: competitorId, organizationId: orgId },
    })
    if (!competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    // Preflight check
    const check = await preflightCheck(workflowType, { competitorId })
    if (!check.ok) {
      return NextResponse.json({ error: 'Setup incomplete', preflightErrors: check.errors }, { status: 422 })
    }

    definition = competitorDeepAnalysisWorkflow
  }

  if (!definition) {
    return NextResponse.json({ error: 'Unknown workflow type' }, { status: 400 })
  }

  const result = await runWorkflow(definition, {
    orgId,
    userId: session.user.id,
    params: competitorId ? { competitorId } : undefined,
  })

  const run = await prisma.workflowRun.findUnique({
    where: { id: result.id },
    include: { steps: { orderBy: { stepIndex: 'asc' } } },
  })

  return NextResponse.json(run)
}
