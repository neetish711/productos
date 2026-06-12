import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { encrypt } from '@/lib/encryption'
import { upsertIntegration } from '@/lib/integrations/db'

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const { personalAccessToken } = await req.json()

    if (!personalAccessToken || typeof personalAccessToken !== 'string' || !personalAccessToken.trim()) {
      return NextResponse.json({ error: 'personalAccessToken required' }, { status: 400 })
    }

    // Verify token against GitHub API
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${personalAccessToken.trim()}`,
        'User-Agent': 'ProductOS/1.0',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!ghRes.ok) {
      return NextResponse.json({ error: 'GitHub rejected the token — check your PAT and scopes' }, { status: 400 })
    }

    const ghUser = await ghRes.json()
    const { ciphertext, iv } = encrypt(personalAccessToken.trim())
    const now = new Date().toISOString()

    await upsertIntegration(orgId, 'GITHUB', {
      status: 'CONNECTED',
      apiKeyEncrypted: ciphertext,
      iv,
      configJson: JSON.stringify({ githubLogin: ghUser.login, githubName: ghUser.name }),
      connectedAt: now,
      lastTestedAt: now,
      errorMessage: null,
    })

    return NextResponse.json({ ok: true, githubLogin: ghUser.login })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to connect' }, { status: 500 })
  }
}
