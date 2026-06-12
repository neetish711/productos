import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { getIntegration, upsertIntegration } from '@/lib/integrations/db'
import { decrypt } from '@/lib/encryption'

export async function POST() {
  try {
    const orgId = await getOrgId()
    const row = await getIntegration(orgId, 'GITHUB')
    if (!row || !row.apiKeyEncrypted || !row.iv) {
      return NextResponse.json({ ok: false, error: 'Not connected' }, { status: 400 })
    }

    const token = decrypt(row.apiKeyEncrypted, row.iv)
    const now = new Date().toISOString()

    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ProductOS/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!ghRes.ok) {
      await upsertIntegration(orgId, 'GITHUB', {
        status: 'CONNECTION_ERROR',
        lastErrorAt: now,
        errorMessage: 'GitHub rejected the token — it may have been revoked or expired',
      })
      return NextResponse.json({ ok: false, error: 'GitHub token is no longer valid' }, { status: 400 })
    }

    const ghUser = await ghRes.json()
    await upsertIntegration(orgId, 'GITHUB', {
      status: 'CONNECTED',
      lastTestedAt: now,
      configJson: JSON.stringify({ githubLogin: ghUser.login, githubName: ghUser.name }),
      errorMessage: null,
    })

    return NextResponse.json({ ok: true, githubLogin: ghUser.login })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? 'Test failed' }, { status: 500 })
  }
}
