// Raw SQL helpers for PrototypePublish and the new RoadmapItem prototype fields.
// We use raw SQL because the Prisma query engine DLL on Windows cannot be hot-replaced
// while the dev server holds it open, so the new schema fields are not in the runtime client.
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrototypePublishRow {
  id: string
  roadmapItemId: string
  publishVersion: number
  sourcePrdVersionId: string | null
  sourcePrdVersionNum: number
  lovablePromptSnapshot: string
  lovablePromptVersion: number
  extractionModel: string | null
  extractionProvider: string | null
  lovableProjectUrl: string | null
  lovableProjectId: string | null
  githubRepoUrl: string | null
  githubBranch: string | null
  githubCommitRef: string | null
  status: string
  prototypeOutdated: number // SQLite stores booleans as 0/1
  publishedByUserId: string | null
  publishedByName: string
  linkedAt: string | null
  handedOffAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── PrototypePublish CRUD ────────────────────────────────────────────────────

export async function getPublishHistory(roadmapItemId: string): Promise<PrototypePublishRow[]> {
  const rows = await prisma.$queryRawUnsafe<PrototypePublishRow[]>(
    `SELECT * FROM "PrototypePublish" WHERE "roadmapItemId" = ? ORDER BY "publishVersion" DESC`,
    roadmapItemId,
  )
  return rows
}

export async function getLatestPublish(roadmapItemId: string): Promise<PrototypePublishRow | null> {
  const rows = await prisma.$queryRawUnsafe<PrototypePublishRow[]>(
    `SELECT * FROM "PrototypePublish" WHERE "roadmapItemId" = ? AND "status" != 'SUPERSEDED' ORDER BY "publishVersion" DESC LIMIT 1`,
    roadmapItemId,
  )
  return rows[0] ?? null
}

export async function getPublishById(id: string): Promise<PrototypePublishRow | null> {
  const rows = await prisma.$queryRawUnsafe<PrototypePublishRow[]>(
    `SELECT * FROM "PrototypePublish" WHERE "id" = ? LIMIT 1`,
    id,
  )
  return rows[0] ?? null
}

export async function getNextPublishVersion(roadmapItemId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ maxVer: number | null }[]>(
    `SELECT MAX("publishVersion") as "maxVer" FROM "PrototypePublish" WHERE "roadmapItemId" = ?`,
    roadmapItemId,
  )
  return (rows[0]?.maxVer ?? 0) + 1
}

export async function createPrototypePublish(data: {
  roadmapItemId: string
  publishVersion: number
  sourcePrdVersionId: string | null
  sourcePrdVersionNum: number
  lovablePromptSnapshot: string
  lovablePromptVersion: number
  extractionModel: string
  extractionProvider: string
  publishedByUserId: string | null
  publishedByName: string
}): Promise<PrototypePublishRow> {
  const id = randomUUID()
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PrototypePublish" (
      "id","roadmapItemId","publishVersion","sourcePrdVersionId","sourcePrdVersionNum",
      "lovablePromptSnapshot","lovablePromptVersion","extractionModel","extractionProvider",
      "lovableProjectUrl","lovableProjectId","githubRepoUrl","githubBranch","githubCommitRef",
      "status","prototypeOutdated","publishedByUserId","publishedByName",
      "linkedAt","handedOffAt","notes","createdAt","updatedAt"
    ) VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,'PROMPT_GENERATED',0,?,?,NULL,NULL,NULL,?,?)`,
    id, data.roadmapItemId, data.publishVersion,
    data.sourcePrdVersionId, data.sourcePrdVersionNum,
    data.lovablePromptSnapshot, data.lovablePromptVersion,
    data.extractionModel, data.extractionProvider,
    data.publishedByUserId, data.publishedByName, now, now,
  )
  return (await getPublishById(id))!
}

export async function updatePublishStatus(id: string, status: string): Promise<void> {
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `UPDATE "PrototypePublish" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?`,
    status, now, id,
  )
}

export async function linkLovableProject(id: string, lovableProjectUrl: string, lovableProjectId: string | null): Promise<void> {
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `UPDATE "PrototypePublish" SET "lovableProjectUrl" = ?, "lovableProjectId" = ?, "status" = 'PROTOTYPE_LINKED', "linkedAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
    lovableProjectUrl, lovableProjectId, now, now, id,
  )
}

export async function linkGithub(id: string, githubRepoUrl: string, githubBranch: string, githubCommitRef: string | null): Promise<void> {
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `UPDATE "PrototypePublish" SET "githubRepoUrl" = ?, "githubBranch" = ?, "githubCommitRef" = ?, "status" = 'GITHUB_LINKED', "updatedAt" = ? WHERE "id" = ?`,
    githubRepoUrl, githubBranch, githubCommitRef, now, id,
  )
}

export async function markHandedOff(id: string): Promise<void> {
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `UPDATE "PrototypePublish" SET "status" = 'HANDED_OFF', "handedOffAt" = ?, "updatedAt" = ? WHERE "id" = ?`,
    now, now, id,
  )
}

export async function supersedePreviousPublishes(roadmapItemId: string, keepId: string): Promise<void> {
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `UPDATE "PrototypePublish" SET "status" = 'SUPERSEDED', "updatedAt" = ? WHERE "roadmapItemId" = ? AND "id" != ? AND "status" != 'SUPERSEDED'`,
    now, roadmapItemId, keepId,
  )
}

// ─── RoadmapItem prototype field updates ─────────────────────────────────────

export async function updateItemPrototypeFields(roadmapItemId: string, fields: {
  prototypeStatus?: string
  lovableProjectUrl?: string | null
  lovableProjectId?: string | null
  githubRepoUrl?: string | null
  githubBranch?: string | null
  githubCommitRef?: string | null
  engineeringHandoffStatus?: string
  prototypeIterationCount?: number
  lastPublishedAt?: string
  lastPublishedBy?: string | null
  sourcePrdVersionId?: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  const sets: string[] = []
  const vals: unknown[] = []

  if (fields.prototypeStatus !== undefined) { sets.push('"prototypeStatus" = ?'); vals.push(fields.prototypeStatus) }
  if (fields.lovableProjectUrl !== undefined) { sets.push('"lovableProjectUrl" = ?'); vals.push(fields.lovableProjectUrl) }
  if (fields.lovableProjectId !== undefined) { sets.push('"lovableProjectId" = ?'); vals.push(fields.lovableProjectId) }
  if (fields.githubRepoUrl !== undefined) { sets.push('"githubRepoUrl" = ?'); vals.push(fields.githubRepoUrl) }
  if (fields.githubBranch !== undefined) { sets.push('"githubBranch" = ?'); vals.push(fields.githubBranch) }
  if (fields.githubCommitRef !== undefined) { sets.push('"githubCommitRef" = ?'); vals.push(fields.githubCommitRef) }
  if (fields.engineeringHandoffStatus !== undefined) { sets.push('"engineeringHandoffStatus" = ?'); vals.push(fields.engineeringHandoffStatus) }
  if (fields.prototypeIterationCount !== undefined) { sets.push('"prototypeIterationCount" = ?'); vals.push(fields.prototypeIterationCount) }
  if (fields.lastPublishedAt !== undefined) { sets.push('"lastPublishedAt" = ?'); vals.push(fields.lastPublishedAt) }
  if (fields.lastPublishedBy !== undefined) { sets.push('"lastPublishedBy" = ?'); vals.push(fields.lastPublishedBy) }
  if (fields.sourcePrdVersionId !== undefined) { sets.push('"sourcePrdVersionId" = ?'); vals.push(fields.sourcePrdVersionId) }

  if (sets.length === 0) return
  sets.push('"updatedAt" = ?')
  vals.push(now)
  vals.push(roadmapItemId)

  await prisma.$executeRawUnsafe(
    `UPDATE "RoadmapItem" SET ${sets.join(', ')} WHERE "id" = ?`,
    ...vals,
  )
}

export async function getItemPrototypeFields(roadmapItemId: string): Promise<{
  prototypeStatus: string
  lovableProjectUrl: string | null
  githubRepoUrl: string | null
  githubBranch: string | null
  engineeringHandoffStatus: string
  prototypeIterationCount: number
  lastPublishedAt: string | null
  sourcePrdVersionId: string | null
} | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "prototypeStatus","lovableProjectUrl","githubRepoUrl","githubBranch","engineeringHandoffStatus","prototypeIterationCount","lastPublishedAt","sourcePrdVersionId" FROM "RoadmapItem" WHERE "id" = ?`,
    roadmapItemId,
  )
  return rows[0] ?? null
}
