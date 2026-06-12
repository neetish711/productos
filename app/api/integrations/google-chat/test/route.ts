import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { getServerSession } from 'next-auth'

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { webhookUrl } = await req.json()
  if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 })

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `✅ ProductOS integration test successful! Connected to ${session.user.name || session.user.email}'s workspace.`,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'Webhook returned error' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Failed to reach webhook' }, { status: 500 })
  }
}
