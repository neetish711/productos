import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { encrypt } from '@/lib/encryption'
import { upsertIntegration } from '@/lib/integrations/db'
import { isGoogleChatWebhook, sendGoogleChatMessage } from '@/lib/integrations/google-chat'

// AUDIT S3-4: persist the Google Chat webhook (encrypted) so the integration
// actually works, instead of the old client-only fake "Connected" state.
export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const { webhookUrl } = await req.json()

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
      return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 })
    }
    // AUDIT S3-5: validate it's a real Google Chat webhook before storing/using.
    if (!isGoogleChatWebhook(webhookUrl.trim())) {
      return NextResponse.json({ error: 'Not a valid Google Chat webhook URL (expected https://chat.googleapis.com/...)' }, { status: 400 })
    }

    // Verify the webhook works before marking connected.
    const test = await sendGoogleChatMessage(webhookUrl.trim(), '✅ ProductOS is now connected to this Google Chat space.')
    if (!test.ok) {
      return NextResponse.json({ error: test.error ?? 'Webhook test failed' }, { status: 400 })
    }

    const { ciphertext, iv } = encrypt(webhookUrl.trim())
    const now = new Date().toISOString()
    await upsertIntegration(orgId, 'GOOGLE_CHAT', {
      status: 'CONNECTED',
      apiKeyEncrypted: ciphertext,
      iv,
      connectedAt: now,
      lastTestedAt: now,
      errorMessage: null,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to connect' }, { status: 500 })
  }
}
