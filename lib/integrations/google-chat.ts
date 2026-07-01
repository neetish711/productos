// AUDIT S3-4/S3-5: Google Chat integration — webhook validation, persistence,
// and real notification dispatch. Replaces the previous fake "Connected" state
// that persisted nothing and sent nothing.
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'

/**
 * AUDIT S3-5: only accept genuine Google Chat incoming-webhook URLs, so the
 * test/dispatch endpoints can't be turned into an open request proxy.
 * Real webhooks look like:
 *   https://chat.googleapis.com/v1/spaces/AAAA/messages?key=...&token=...
 */
export function isGoogleChatWebhook(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === 'chat.googleapis.com' && url.pathname.includes('/messages')
  } catch {
    return false
  }
}

/** POST a plain-text message to a Google Chat webhook. Returns ok + optional error. */
export async function sendGoogleChatMessage(webhookUrl: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isGoogleChatWebhook(webhookUrl)) return { ok: false, error: 'Not a valid Google Chat webhook URL' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { ok: false, error: `Webhook returned ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to reach webhook' }
  }
}

/**
 * Best-effort notification to an org's configured Google Chat space. No-op (never
 * throws) when the integration isn't connected, so callers can fire-and-forget
 * without guarding every event.
 */
export async function notifyGoogleChat(orgId: string, text: string): Promise<void> {
  try {
    const integration = await prisma.integrationConfig.findUnique({
      where: { organizationId_integrationType: { organizationId: orgId, integrationType: 'GOOGLE_CHAT' } },
    })
    if (!integration || integration.status !== 'CONNECTED' || !integration.apiKeyEncrypted || !integration.iv) return
    const webhookUrl = decrypt(integration.apiKeyEncrypted, integration.iv)
    await sendGoogleChatMessage(webhookUrl, text)
  } catch (e) {
    console.error('notifyGoogleChat failed:', e)
  }
}
