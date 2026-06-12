import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { encrypt } from '@/lib/encryption'
import { upsertIntegration } from '@/lib/integrations/db'

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const { apiKey } = await req.json()

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ error: 'apiKey required' }, { status: 400 })
    }

    const { ciphertext, iv } = encrypt(apiKey.trim())
    const now = new Date().toISOString()

    await upsertIntegration(orgId, 'LOVABLE', {
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
