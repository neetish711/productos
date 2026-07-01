import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '@/types/workflow'
import { competitorRefreshWorkflow } from './definitions/competitor-refresh'
import { competitorDeepAnalysisWorkflow } from './definitions/competitor-deep-analysis'

// AUDIT S2-1: registry so the queue worker can resolve a persisted run's type
// back to its definition without the HTTP route.
const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
  COMPETITOR_REFRESH: competitorRefreshWorkflow,
  COMPETITOR_DEEP_ANALYSIS: competitorDeepAnalysisWorkflow,
}

// A run whose execution began more than this ago with no completion is
// considered dead and is reaped (marked FAILED) rather than wedging forever.
const RUN_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Pre-flight check: validate that the competitor has required data for the workflow.
 */
export async function preflightCheck(
  workflowType: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []

  if (workflowType === 'COMPETITOR_DEEP_ANALYSIS' && params?.competitorId) {
    const competitor = await prisma.competitor.findUnique({
      where: { id: params.competitorId },
      include: {
        managedSources: { where: { isActive: true }, select: { id: true } },
        features: { select: { id: true } },
      },
    })
    if (!competitor) {
      errors.push('Competitor not found')
    } else {
      if (competitor.managedSources.length === 0) {
        errors.push('No active sources configured. Add sources before running Deep Analysis.')
      }
      if (competitor.features.length === 0) {
        errors.push('No features tracked. Add features before running Deep Analysis.')
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Idempotency check: prevent duplicate concurrent runs.
 */
export async function getInFlightRun(
  workflowType: string,
  orgId: string,
  competitorId?: string,
): Promise<{ id: string; status: string } | null> {
  // AUDIT S2-1: treat QUEUED and (fresh) RUNNING as in-flight, but IGNORE stale
  // RUNNING runs (startedAt older than the timeout). Previously any RUNNING row —
  // including one left behind by a dead serverless process — blocked the
  // competitor's workflows permanently. Stale runs are reaped separately.
  const cutoff = new Date(Date.now() - RUN_TIMEOUT_MS)
  const where: any = {
    organizationId: orgId,
    workflowType,
    OR: [
      { status: 'QUEUED' },
      { status: 'RUNNING', startedAt: { gte: cutoff } },
    ],
  }
  if (competitorId) {
    where.inputParamsJson = { contains: competitorId }
  }
  const existing = await prisma.workflowRun.findFirst({ where, select: { id: true, status: true } })
  return existing ?? null
}

export async function runWorkflow(
  definition: WorkflowDefinition,
  ctx: WorkflowContext,
): Promise<{ id: string; status: string }> {
  // Create WorkflowRun record
  const run = await prisma.workflowRun.create({
    data: {
      organizationId: ctx.orgId,
      workflowType: definition.type as any,
      status: 'RUNNING',
      inputParamsJson: JSON.stringify(ctx.params || {}),
      totalTokens: 0,
      estimatedCost: 0,
    } as any,
  })

  // Create step records with stepIndex for ordering
  for (let i = 0; i < definition.steps.length; i++) {
    await prisma.workflowStepRun.create({
      data: {
        workflowRunId: run.id,
        stepName: definition.steps[i].name,
        stepIndex: i,
        status: 'PENDING',
        tokensUsed: 0,
      },
    })
  }

  // AUDIT S2-1: the run is now QUEUED and executed by the durable queue worker,
  // not a detached fire-and-forget promise (which died when the serverless
  // function returned, leaving the run stuck in RUNNING forever). We kick a
  // best-effort immediate drain so it starts promptly; if this process dies, the
  // workflow-drain cron picks it up and the reaper clears anything stuck.
  void drainWorkflowQueue().catch((err) => console.error('drainWorkflowQueue error:', err))

  return { id: run.id, status: 'QUEUED' }
}

/**
 * AUDIT S2-1: atomically claim a QUEUED run for execution. Returns false if
 * another worker already claimed it (guards against double-execution).
 */
async function claimRun(runId: string): Promise<boolean> {
  const res = await prisma.workflowRun.updateMany({
    where: { id: runId, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  return res.count === 1
}

/**
 * AUDIT S2-1: reaper. Fails runs that have been RUNNING past the timeout with no
 * completion (e.g. the worker process died mid-run), so they stop wedging the
 * competitor and are visibly FAILED rather than eternally "running".
 */
export async function reapStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - RUN_TIMEOUT_MS)
  const stale = await prisma.workflowRun.findMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    select: { id: true },
  })
  for (const r of stale) {
    await prisma.workflowStepRun.updateMany({
      where: { workflowRunId: r.id, status: 'RUNNING' },
      data: { status: 'FAILED', outputJson: JSON.stringify({ error: 'Timed out — reaped' }), completedAt: new Date() },
    })
    await prisma.workflowRun.update({
      where: { id: r.id },
      data: { status: 'FAILED', errorMessage: 'Workflow exceeded the time limit and was reaped', completedAt: new Date() },
    })
  }
  return stale.length
}

/**
 * AUDIT S2-1: the queue worker. Reaps stale runs, then claims and executes up to
 * `limit` QUEUED runs to completion. Safe to call concurrently (claim is atomic)
 * and idempotent — call it from the workflow-drain cron and after enqueue.
 */
export async function drainWorkflowQueue(limit = 3): Promise<{ processed: number; reaped: number }> {
  const reaped = await reapStaleRuns()
  const queued = await prisma.workflowRun.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let processed = 0
  for (const run of queued) {
    if (!(await claimRun(run.id))) continue // another worker took it

    const definition = WORKFLOW_REGISTRY[run.workflowType]
    if (!definition) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage: `Unknown workflow type: ${run.workflowType}`, completedAt: new Date() },
      })
      continue
    }

    const ctx: WorkflowContext = {
      orgId: run.organizationId,
      params: JSON.parse(run.inputParamsJson || '{}'),
    }
    try {
      await executeSteps(run.id, definition, ctx)
    } catch (err) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Unknown error', completedAt: new Date() },
      })
    }
    processed++
  }

  return { processed, reaped }
}

async function executeSteps(
  runId: string,
  definition: WorkflowDefinition,
  ctx: WorkflowContext,
): Promise<void> {
  let totalTokens = 0
  let totalCost = 0
  const stepResults: Record<string, WorkflowStepResult> = {}
  let aborted = false

  for (const stepDef of definition.steps) {
    const stepRun = await prisma.workflowStepRun.findFirst({
      where: { workflowRunId: runId, stepName: stepDef.name },
    })
    if (!stepRun) continue

    // If a required step failed earlier, skip all downstream steps
    if (aborted) {
      await prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: {
          status: 'SKIPPED',
          outputJson: JSON.stringify({ reason: 'Skipped due to earlier required step failure' }),
        } as any,
      })
      ctx.onStepUpdate?.({ stepName: stepDef.name, status: 'skipped' })
      continue
    }

    // Check dependency: BATTLECARD_UPDATE depends on REPORT_GENERATION
    if (stepDef.name === 'BATTLECARD_UPDATE') {
      const reportResult = stepResults['REPORT_GENERATION']
      if (!reportResult || !reportResult.data) {
        await prisma.workflowStepRun.update({
          where: { id: stepRun.id },
          data: {
            status: 'SKIPPED',
            outputJson: JSON.stringify({ reason: 'No fresh report — report generation was skipped or failed' }),
          } as any,
        })
        ctx.onStepUpdate?.({ stepName: stepDef.name, status: 'skipped', output: 'No fresh report' })
        continue
      }
    }

    // Mark step as running
    await prisma.workflowStepRun.update({
      where: { id: stepRun.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    })
    ctx.onStepUpdate?.({ stepName: stepDef.name, status: 'running' })

    try {
      const aiClient = await getAIClient(ctx.orgId)
      const result = await stepDef.execute({ ctx, aiClient, previousResults: stepResults })

      stepResults[stepDef.name] = result

      await prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: {
          status: 'COMPLETED',
          outputJson: JSON.stringify({ summary: result.summary, data: result.data }),
          tokensUsed: result.tokensUsed || 0,
          completedAt: new Date(),
        } as any,
      })

      totalTokens += result.tokensUsed || 0
      totalCost += result.estimatedCost || 0

      ctx.onStepUpdate?.({ stepName: stepDef.name, status: 'completed', output: result.summary })

      // Persist accumulated tokens on the run after each step
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { totalTokens, estimatedCost: totalCost },
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'

      await prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: {
          status: 'FAILED',
          outputJson: JSON.stringify({ error: errMsg }),
          completedAt: new Date(),
        } as any,
      })
      ctx.onStepUpdate?.({ stepName: stepDef.name, status: 'failed', output: errMsg })

      if (stepDef.required !== false) {
        // Required step failed → abort remaining steps
        aborted = true
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { status: 'FAILED', totalTokens, estimatedCost: totalCost, errorMessage: `Step "${stepDef.name}" failed: ${errMsg}` },
        })
        // Don't throw — continue loop to mark remaining steps as SKIPPED
      }
      // Optional step failed → continue (non-blocking warning)
    }
  }

  if (!aborted) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', totalTokens, estimatedCost: totalCost, completedAt: new Date() },
    })
  }
}
