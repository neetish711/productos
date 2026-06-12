import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { maskApiKey } from '@/lib/encryption'

async function getIntegrationStatus(orgId: string, type: string) {
  const row = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, configJson, connectedAt, lastTestedAt, errorMessage, apiKeyEncrypted, iv
     FROM IntegrationConfig WHERE organizationId = ? AND integrationType = ? LIMIT 1`,
    orgId, type,
  )
  const r = row[0]
  if (!r) return { status: 'NOT_CONNECTED', connected: false }
  return {
    id: r.id,
    status: r.status,
    connected: r.status === 'CONNECTED',
    connectedAt: r.connectedAt,
    lastTestedAt: r.lastTestedAt,
    errorMessage: r.errorMessage,
    maskedKey: r.apiKeyEncrypted && r.iv ? maskApiKey('placeholder') : null,
    configJson: r.configJson ? JSON.parse(r.configJson) : {},
  }
}

export async function GET() {
  try {
    const orgId = await getOrgId()
    const [lovable, github] = await Promise.all([
      getIntegrationStatus(orgId, 'LOVABLE'),
      getIntegrationStatus(orgId, 'GITHUB'),
    ])
    return NextResponse.json({ lovable, github })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
