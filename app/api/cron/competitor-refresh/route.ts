import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runWorkflow } from '@/lib/workflow-engine/engine'
import { competitorRefreshWorkflow } from '@/lib/workflow-engine/definitions/competitor-refresh'

// This route is called by cron or manually
export async function POST(req: Request) {
  // AUDIT P0-8: Require the cron secret unconditionally. Previously the check was
  // skipped when the header was absent (`if (secret && secret !== ...)`), so an
  // unauthenticated POST with no header ran workflows for every org (cost DoS).
  const expected = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orgs = await prisma.organization.findMany({
      where: { onboardingCompleted: true },
      select: { id: true },
    })

    const results = []
    for (const org of orgs) {
      const result = await runWorkflow(competitorRefreshWorkflow, { orgId: org.id })
      results.push(result)
    }

    return NextResponse.json({ ok: true, runs: results.length })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
