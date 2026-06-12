import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  jiraBaseUrl: z.string().url().optional().or(z.literal('')),
  jiraEmail: z.string().email().optional().or(z.literal('')),
  jiraToken: z.string().optional(),
})

// GET /api/jira/settings — return current Jira config (masked token)
export async function GET() {
  try {
    const orgId = await getOrgId()
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settingsJson: true } })
    const settings = JSON.parse(org?.settingsJson ?? '{}')
    return NextResponse.json({
      jiraBaseUrl: settings.jiraBaseUrl ?? '',
      jiraEmail: settings.jiraEmail ?? '',
      jiraTokenSet: !!(settings.jiraToken),
    })
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

// PUT /api/jira/settings — update Jira config
export async function PUT(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = updateSchema.parse(await req.json())
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settingsJson: true } })
    const existing = JSON.parse(org?.settingsJson ?? '{}')
    const updated = { ...existing, ...body }
    await prisma.organization.update({ where: { id: orgId }, data: { settingsJson: JSON.stringify(updated) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
