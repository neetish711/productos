import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { upsertIntegration } from '@/lib/integrations/db'

// AUDIT S3-4: disconnect Google Chat — clears the stored webhook + status.
export async function POST() {
  try {
    const orgId = await getOrgId()
    await upsertIntegration(orgId, 'GOOGLE_CHAT', {
      status: 'NOT_CONNECTED',
      apiKeyEncrypted: null,
      iv: null,
      connectedAt: null,
      errorMessage: null,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to disconnect' }, { status: 500 })
  }
}
