import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { runWorkflow, getInFlightRun } from '@/lib/workflow-engine/engine'
import { competitorRefreshWorkflow } from '@/lib/workflow-engine/definitions/competitor-refresh'

// AUDIT S4-keyupd: user-triggered refresh, separate from the cron-only endpoint.
// Authenticated by session (not the shared CRON_SECRET) and scoped to the caller's org.
export async function POST() {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgId = session.user.organizationId

  // Idempotent: reuse an in-flight refresh instead of stacking duplicates.
  const inFlight = await getInFlightRun('COMPETITOR_REFRESH', orgId)
  if (inFlight) {
    return NextResponse.json({ ok: true, runId: inFlight.id, alreadyRunning: true })
  }

  const run = await runWorkflow(competitorRefreshWorkflow, { orgId, userId: session.user.id })
  return NextResponse.json({ ok: true, runId: run.id })
}
