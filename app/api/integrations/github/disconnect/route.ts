import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { upsertIntegration } from '@/lib/integrations/db'

export async function POST() {
  try {
    const orgId = await getOrgId()
    await upsertIntegration(orgId, 'GITHUB', {
      status: 'NOT_CONNECTED',
      apiKeyEncrypted: null,
      iv: null,
      configJson: '{}',
      connectedAt: null,
      connectedBy: null,
      errorMessage: null,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to disconnect' }, { status: 500 })
  }
}
