// Raw SQL helpers for IntegrationConfig (DLL not updated on Windows dev)
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function upsertIntegration(orgId: string, type: string, fields: {
  status?: string
  apiKeyEncrypted?: string | null
  iv?: string | null
  configJson?: string
  connectedAt?: string | null
  connectedBy?: string | null
  lastTestedAt?: string | null
  lastErrorAt?: string | null
  errorMessage?: string | null
}) {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM IntegrationConfig WHERE organizationId = ? AND integrationType = ? LIMIT 1`,
    orgId, type,
  )
  const now = new Date().toISOString()

  if (existing.length > 0) {
    const sets: string[] = []
    const vals: unknown[] = []
    if (fields.status !== undefined)         { sets.push('"status" = ?');         vals.push(fields.status) }
    if (fields.apiKeyEncrypted !== undefined){ sets.push('"apiKeyEncrypted" = ?'); vals.push(fields.apiKeyEncrypted) }
    if (fields.iv !== undefined)             { sets.push('"iv" = ?');             vals.push(fields.iv) }
    if (fields.configJson !== undefined)     { sets.push('"configJson" = ?');     vals.push(fields.configJson) }
    if (fields.connectedAt !== undefined)    { sets.push('"connectedAt" = ?');    vals.push(fields.connectedAt) }
    if (fields.connectedBy !== undefined)    { sets.push('"connectedBy" = ?');    vals.push(fields.connectedBy) }
    if (fields.lastTestedAt !== undefined)   { sets.push('"lastTestedAt" = ?');   vals.push(fields.lastTestedAt) }
    if (fields.lastErrorAt !== undefined)    { sets.push('"lastErrorAt" = ?');    vals.push(fields.lastErrorAt) }
    if (fields.errorMessage !== undefined)   { sets.push('"errorMessage" = ?');   vals.push(fields.errorMessage) }
    sets.push('"updatedAt" = ?')
    vals.push(now)
    vals.push(existing[0].id)
    await prisma.$executeRawUnsafe(
      `UPDATE IntegrationConfig SET ${sets.join(', ')} WHERE id = ?`,
      ...vals,
    )
    return existing[0].id
  } else {
    const id = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO IntegrationConfig (id, organizationId, integrationType, status, apiKeyEncrypted, iv, configJson, connectedAt, connectedBy, lastTestedAt, lastErrorAt, errorMessage, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, orgId, type,
      fields.status ?? 'NOT_CONNECTED',
      fields.apiKeyEncrypted ?? null,
      fields.iv ?? null,
      fields.configJson ?? '{}',
      fields.connectedAt ?? null,
      fields.connectedBy ?? null,
      fields.lastTestedAt ?? null,
      fields.lastErrorAt ?? null,
      fields.errorMessage ?? null,
      now, now,
    )
    return id
  }
}

export async function getIntegration(orgId: string, type: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM IntegrationConfig WHERE organizationId = ? AND integrationType = ? LIMIT 1`,
    orgId, type,
  )
  return rows[0] ?? null
}
