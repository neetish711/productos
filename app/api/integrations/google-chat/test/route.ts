import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { getServerSession } from 'next-auth'
import { isGoogleChatWebhook, sendGoogleChatMessage } from '@/lib/integrations/google-chat'

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { webhookUrl } = await req.json()
  if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 })

  // AUDIT S3-5: validate the URL is a Google Chat webhook before fetching it, so
  // this endpoint can't be used to POST to arbitrary URLs.
  if (!isGoogleChatWebhook(webhookUrl)) {
    return NextResponse.json({ ok: false, error: 'Not a valid Google Chat webhook URL' }, { status: 400 })
  }

  const result = await sendGoogleChatMessage(
    webhookUrl,
    `✅ ProductOS integration test successful! Connected to ${session.user.name || session.user.email}'s workspace.`,
  )
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
