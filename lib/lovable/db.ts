// AUDIT P0-3: typed Prisma access for PrototypePublish and RoadmapItem prototype
// fields. Previously raw SQL with SQLite-only `?` placeholders and boolean-as-0/1,
// both of which break on PostgreSQL. All fields are declared on the models, so the
// typed client is used directly. Return types are now the Prisma model types
// (Date for timestamps, boolean for prototypeOutdated) — consumers serialize these
// to JSON (Date → ISO string) or read fields by name, so behavior is preserved.
import { prisma } from '@/lib/db'

// ─── PrototypePublish CRUD ────────────────────────────────────────────────────

export async function getPublishHistory(roadmapItemId: string) {
  return prisma.prototypePublish.findMany({
    where: { roadmapItemId },
    orderBy: { publishVersion: 'desc' },
  })
}

export async function getLatestPublish(roadmapItemId: string) {
  return prisma.prototypePublish.findFirst({
    where: { roadmapItemId, status: { not: 'SUPERSEDED' } },
    orderBy: { publishVersion: 'desc' },
  })
}

export async function getPublishById(id: string) {
  return prisma.prototypePublish.findUnique({ where: { id } })
}

export async function getNextPublishVersion(roadmapItemId: string): Promise<number> {
  const agg = await prisma.prototypePublish.aggregate({
    where: { roadmapItemId },
    _max: { publishVersion: true },
  })
  return (agg._max.publishVersion ?? 0) + 1
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
}) {
  return prisma.prototypePublish.create({
    data: {
      roadmapItemId: data.roadmapItemId,
      publishVersion: data.publishVersion,
      sourcePrdVersionId: data.sourcePrdVersionId,
      sourcePrdVersionNum: data.sourcePrdVersionNum,
      lovablePromptSnapshot: data.lovablePromptSnapshot,
      lovablePromptVersion: data.lovablePromptVersion,
      extractionModel: data.extractionModel,
      extractionProvider: data.extractionProvider,
      status: 'PROMPT_GENERATED',
      prototypeOutdated: false,
      publishedByUserId: data.publishedByUserId,
      publishedByName: data.publishedByName,
    },
  })
}

export async function updatePublishStatus(id: string, status: string): Promise<void> {
  await prisma.prototypePublish.update({ where: { id }, data: { status } })
}

export async function linkLovableProject(id: string, lovableProjectUrl: string, lovableProjectId: string | null): Promise<void> {
  await prisma.prototypePublish.update({
    where: { id },
    data: { lovableProjectUrl, lovableProjectId, status: 'PROTOTYPE_LINKED', linkedAt: new Date() },
  })
}

export async function linkGithub(id: string, githubRepoUrl: string, githubBranch: string, githubCommitRef: string | null): Promise<void> {
  await prisma.prototypePublish.update({
    where: { id },
    data: { githubRepoUrl, githubBranch, githubCommitRef, status: 'GITHUB_LINKED' },
  })
}

export async function markHandedOff(id: string): Promise<void> {
  await prisma.prototypePublish.update({
    where: { id },
    data: { status: 'HANDED_OFF', handedOffAt: new Date() },
  })
}

export async function supersedePreviousPublishes(roadmapItemId: string, keepId: string): Promise<void> {
  await prisma.prototypePublish.updateMany({
    where: { roadmapItemId, id: { not: keepId }, status: { not: 'SUPERSEDED' } },
    data: { status: 'SUPERSEDED' },
  })
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
  const data: Record<string, unknown> = {}
  if (fields.prototypeStatus !== undefined) data.prototypeStatus = fields.prototypeStatus
  if (fields.lovableProjectUrl !== undefined) data.lovableProjectUrl = fields.lovableProjectUrl
  if (fields.lovableProjectId !== undefined) data.lovableProjectId = fields.lovableProjectId
  if (fields.githubRepoUrl !== undefined) data.githubRepoUrl = fields.githubRepoUrl
  if (fields.githubBranch !== undefined) data.githubBranch = fields.githubBranch
  if (fields.githubCommitRef !== undefined) data.githubCommitRef = fields.githubCommitRef
  if (fields.engineeringHandoffStatus !== undefined) data.engineeringHandoffStatus = fields.engineeringHandoffStatus
  if (fields.prototypeIterationCount !== undefined) data.prototypeIterationCount = fields.prototypeIterationCount
  if (fields.lastPublishedAt !== undefined) data.lastPublishedAt = new Date(fields.lastPublishedAt)
  if (fields.lastPublishedBy !== undefined) data.lastPublishedBy = fields.lastPublishedBy
  if (fields.sourcePrdVersionId !== undefined) data.sourcePrdVersionId = fields.sourcePrdVersionId

  if (Object.keys(data).length === 0) return
  await prisma.roadmapItem.update({ where: { id: roadmapItemId }, data })
}

export async function getItemPrototypeFields(roadmapItemId: string) {
  return prisma.roadmapItem.findUnique({
    where: { id: roadmapItemId },
    select: {
      prototypeStatus: true,
      lovableProjectUrl: true,
      githubRepoUrl: true,
      githubBranch: true,
      engineeringHandoffStatus: true,
      prototypeIterationCount: true,
      lastPublishedAt: true,
      sourcePrdVersionId: true,
    },
  })
}
