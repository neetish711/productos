import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import type { WorkflowDefinition, WorkflowContext, WorkflowStepResult } from '@/types/workflow'

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
  const where: any = {
    organizationId: orgId,
    workflowType,
    status: 'RUNNING',
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

  // Run steps asynchronously (fire-and-forget from API perspective)
  executeSteps(run.id, definition, ctx).catch(async (err) => {
    console.error(`Workflow ${run.id} failed:`, err)
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Unknown error' },
    })
  })

  return { id: run.id, status: 'RUNNING' }
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
