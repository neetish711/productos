import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { getIntegration, upsertIntegration } from '@/lib/integrations/db'
import { decrypt } from '@/lib/encryption'

export async function POST() {
  try {
    const orgId = await getOrgId()
    const row = await getIntegration(orgId, 'LOVABLE')
    if (!row || !row.apiKeyEncrypted || !row.iv) {
      return NextResponse.json({ ok: false, error: 'Not connected' }, { status: 400 })
    }

    const apiKey = decrypt(row.apiKeyEncrypted, row.iv)
    const now = new Date().toISOString()

    // Lovable doesn't have a public API endpoint — validate by checking key format
    // A real Lovable API key starts with "sk-" or similar; we just verify it's non-empty
    if (!apiKey || apiKey.length < 8) {
      await upsertIntegration(orgId, 'LOVABLE', {
        status: 'CONNECTION_ERROR',
        lastErrorAt: now,
        errorMessage: 'API key appears invalid',
      })
      return NextResponse.json({ ok: false, error: 'API key appears invalid' }, { status: 400 })
    }

    await upsertIntegration(orgId, 'LOVABLE', {
      status: 'CONNECTED',
      lastTestedAt: now,
      errorMessage: null,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? 'Test failed' }, { status: 500 })
  }
}
