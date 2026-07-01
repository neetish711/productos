// AUDIT P0-3: typed Prisma access for IntegrationConfig.
// Previously used raw SQL with SQLite-only `?` placeholders and unquoted,
// mixed-case identifiers (which break on PostgreSQL). The @@unique on
// (organizationId, integrationType) lets us use a clean upsert.
import { prisma } from '@/lib/db'

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  return new Date(v)
}

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
  const data = {
    ...(fields.status !== undefined && { status: fields.status }),
    ...(fields.apiKeyEncrypted !== undefined && { apiKeyEncrypted: fields.apiKeyEncrypted }),
    ...(fields.iv !== undefined && { iv: fields.iv }),
    ...(fields.configJson !== undefined && { configJson: fields.configJson }),
    ...(fields.connectedAt !== undefined && { connectedAt: toDate(fields.connectedAt) }),
    ...(fields.connectedBy !== undefined && { connectedBy: fields.connectedBy }),
    ...(fields.lastTestedAt !== undefined && { lastTestedAt: toDate(fields.lastTestedAt) }),
    ...(fields.lastErrorAt !== undefined && { lastErrorAt: toDate(fields.lastErrorAt) }),
    ...(fields.errorMessage !== undefined && { errorMessage: fields.errorMessage }),
  }

  const rec = await prisma.integrationConfig.upsert({
    where: { organizationId_integrationType: { organizationId: orgId, integrationType: type } },
    create: { organizationId: orgId, integrationType: type, status: fields.status ?? 'NOT_CONNECTED', ...data },
    update: data,
  })
  return rec.id
}

export async function getIntegration(orgId: string, type: string) {
  return prisma.integrationConfig.findUnique({
    where: { organizationId_integrationType: { organizationId: orgId, integrationType: type } },
  })
}
