import { NextResponse } from 'next/server'
import { drainWorkflowQueue } from '@/lib/workflow-engine/engine'

// AUDIT S2-1: durable queue worker. Point a scheduler (Railway cron) at this
// endpoint on a short interval; it reaps stale runs and executes QUEUED runs to
// completion. Secured with the same unconditional CRON_SECRET check as P0-8.
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { processed, reaped } = await drainWorkflowQueue(5)
    return NextResponse.json({ ok: true, processed, reaped })
  } catch (err) {
    console.error('workflow-drain error:', err)
    return NextResponse.json({ error: 'Drain failed' }, { status: 500 })
  }
}
