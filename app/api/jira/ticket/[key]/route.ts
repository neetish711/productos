import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getJiraConfig(settingsJson: string): { baseUrl: string; email: string; token: string } | null {
  try {
    const s = JSON.parse(settingsJson)
    if (s.jiraBaseUrl && s.jiraEmail && s.jiraToken) return s
    return null
  } catch { return null }
}

function jiraAuthHeader(email: string, token: string) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockTicket(key: string) {
  const prefix = key.split('-')[0] ?? 'PROJ'
  const num = parseInt(key.split('-')[1] ?? '42', 10)
  const statuses = ['To Do', 'In Progress', 'In Review', 'Done']
  const status = statuses[num % statuses.length]

  return {
    key,
    summary: `[Mock] Feature request related to ${key}`,
    status: {
      name: status,
      statusCategory: {
        colorName: status === 'Done' ? 'green' : status === 'In Progress' ? 'yellow' : 'blue-gray',
      },
    },
    issuetype: { name: 'Story' },
    priority: { name: 'Medium' },
    assignee: { displayName: 'Alex Johnson', avatarUrls: { '24x24': '' } },
    reporter: { displayName: 'Product Manager' },
    description: 'This is a mock Jira ticket shown because no Jira integration is configured. Connect your Jira workspace in Settings → Integrations.',
    epic: {
      key: `${prefix}-${num - 5 > 0 ? num - 5 : 1}`,
      summary: `Epic: ${prefix} Q2 Improvements`,
    },
    subtasks: [
      { key: `${prefix}-${num + 1}`, summary: 'Frontend implementation', status: 'In Progress' },
      { key: `${prefix}-${num + 2}`, summary: 'API endpoint', status: 'Done' },
      { key: `${prefix}-${num + 3}`, summary: 'QA & testing', status: 'To Do' },
    ],
    comments: [
      {
        id: 'c1',
        author: { displayName: 'Alex Johnson', avatarUrls: { '24x24': '' } },
        body: 'Reviewed the spec — looks good. We can start implementation after sprint planning.',
        created: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        id: 'c2',
        author: { displayName: 'Sam Rivera', avatarUrls: { '24x24': '' } },
        body: 'I have a few concerns about edge cases. Added some notes to the design doc.',
        created: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
    changelog: [
      {
        created: new Date(Date.now() - 7 * 86400000).toISOString(),
        author: 'Product Manager',
        items: [{ field: 'Status', fromString: 'Backlog', toString: 'To Do' }],
      },
      {
        created: new Date(Date.now() - 4 * 86400000).toISOString(),
        author: 'Alex Johnson',
        items: [{ field: 'Status', fromString: 'To Do', toString: 'In Progress' }],
      },
      {
        created: new Date(Date.now() - 2 * 86400000).toISOString(),
        author: 'Alex Johnson',
        items: [{ field: 'Assignee', fromString: null, toString: 'Alex Johnson' }],
      },
    ],
    availableTransitions: [
      { id: '11', name: 'To Do' },
      { id: '21', name: 'In Progress' },
      { id: '31', name: 'In Review' },
      { id: '41', name: 'Done' },
    ],
    isMock: true,
  }
}

// ─── GET /api/jira/ticket/[key] ───────────────────────────────────────────────

export async function GET(_: Request, { params }: { params: { key: string } }) {
  try {
    const orgId = await getOrgId()
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settingsJson: true } })
    const config = getJiraConfig(org?.settingsJson ?? '{}')

    if (!config) {
      return NextResponse.json(mockTicket(params.key))
    }

    // Fetch from real Jira API
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const auth = jiraAuthHeader(config.email, config.token)

    // Fetch issue + changelog + transitions in parallel
    const [issueRes, transitionsRes] = await Promise.all([
      fetch(
        `${baseUrl}/rest/api/3/issue/${params.key}?fields=summary,status,issuetype,priority,assignee,reporter,description,parent,subtasks,comment&expand=changelog`,
        { headers: { Authorization: auth, Accept: 'application/json' } }
      ),
      fetch(`${baseUrl}/rest/api/3/issue/${params.key}/transitions`, {
        headers: { Authorization: auth, Accept: 'application/json' },
      }),
    ])

    if (!issueRes.ok) {
      const err = await issueRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.errorMessages?.[0] ?? 'Jira request failed' },
        { status: issueRes.status }
      )
    }

    const issue = await issueRes.json()
    const transitions = transitionsRes.ok ? await transitionsRes.json() : { transitions: [] }
    const f = issue.fields

    // Normalize into flat structure
    const epic = f.parent?.fields?.issuetype?.name === 'Epic'
      ? { key: f.parent.key, summary: f.parent.fields.summary }
      : null

    const comments = (f.comment?.comments ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      author: c.author,
      body: typeof c.body === 'string'
        ? c.body
        : (c.body as Record<string, unknown>)?.content ? '[Rich text]' : '',
      created: c.created,
    }))

    const changelog = (issue.changelog?.histories ?? []).map((h: Record<string, unknown>) => ({
      created: h.created,
      author: (h.author as Record<string, string>)?.displayName,
      items: (h.items as Record<string, string>[]) ?? [],
    }))

    return NextResponse.json({
      key: issue.key,
      summary: f.summary,
      status: f.status,
      issuetype: f.issuetype,
      priority: f.priority,
      assignee: f.assignee,
      reporter: f.reporter,
      description: typeof f.description === 'string' ? f.description : null,
      epic,
      subtasks: (f.subtasks ?? []).map((s: Record<string, unknown>) => ({
        key: s.key,
        summary: (s.fields as Record<string, string>)?.summary,
        status: ((s.fields as Record<string, Record<string, string>>)?.status)?.name,
      })),
      comments,
      changelog,
      availableTransitions: transitions.transitions ?? [],
      isMock: false,
    })
  } catch (e) {
    console.error('[jira/ticket]', e)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}
