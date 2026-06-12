import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({ transitionId: z.string() })

function getJiraConfig(settingsJson: string) {
  try {
    const s = JSON.parse(settingsJson)
    if (s.jiraBaseUrl && s.jiraEmail && s.jiraToken) return s
    return null
  } catch { return null }
}

// PUT /api/jira/ticket/[key]/status
// Body: { transitionId: string }
export async function PUT(req: Request, { params }: { params: { key: string } }) {
  try {
    const orgId = await getOrgId()
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settingsJson: true } })
    const config = getJiraConfig(org?.settingsJson ?? '{}')

    const body = schema.parse(await req.json())

    if (!config) {
      // Mock success — allow UI to optimistically update without real Jira
      return NextResponse.json({ ok: true, mock: true })
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${config.email}:${config.token}`).toString('base64')

    const res = await fetch(`${baseUrl}/rest/api/3/issue/${params.key}/transitions`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ transition: { id: body.transitionId } }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.errorMessages?.[0] ?? 'Status update failed' },
        { status: res.status }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
