import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({ body: z.string().min(1) })

function getJiraConfig(settingsJson: string) {
  try {
    const s = JSON.parse(settingsJson)
    if (s.jiraBaseUrl && s.jiraEmail && s.jiraToken) return s
    return null
  } catch { return null }
}

// POST /api/jira/ticket/[key]/comment
// Body: { body: string }
export async function POST(req: Request, { params }: { params: { key: string } }) {
  try {
    const orgId = await getOrgId()
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settingsJson: true } })
    const config = getJiraConfig(org?.settingsJson ?? '{}')

    const input = schema.parse(await req.json())

    if (!config) {
      // Mock success — return a fake comment so UI can append it
      return NextResponse.json({
        id: `mock-${Date.now()}`,
        author: { displayName: 'You', avatarUrls: { '24x24': '' } },
        body: input.body,
        created: new Date().toISOString(),
        mock: true,
      }, { status: 201 })
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${config.email}:${config.token}`).toString('base64')

    const res = await fetch(`${baseUrl}/rest/api/3/issue/${params.key}/comment`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: input.body }] }],
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.errorMessages?.[0] ?? 'Comment failed' },
        { status: res.status }
      )
    }

    const comment = await res.json()
    return NextResponse.json({
      id: comment.id,
      author: comment.author,
      body: input.body,
      created: comment.created,
    }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
}
