import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runWorkflow } from '@/lib/workflow-engine/engine'
import { competitorRefreshWorkflow } from '@/lib/workflow-engine/definitions/competitor-refresh'

// This route is called by cron or manually
export async function POST(req: Request) {
  // Verify cron secret if called by scheduler
  const secret = req.headers.get('x-cron-secret')
  if (secret && secret !== process.env.CRON_SECRET) {
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
