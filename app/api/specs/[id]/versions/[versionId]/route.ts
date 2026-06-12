import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

// Roles that may delete spec versions
const REVIEWER_ROLES = ['ADMIN', 'REVIEWER', 'SENIOR_PM']

// ---------------------------------------------------------------------------
// PATCH /api/specs/[id]/versions/[versionId] — rename a version
// ---------------------------------------------------------------------------
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const orgId = await getOrgId()

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { versionName } = await req.json()

    const updated = await prisma.specVersion.update({
      where: { id: params.versionId },
      data: { versionName: versionName ?? null },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/specs/[id]/versions/[versionId] — delete an older version
//
// Guardrails:
//  1. Role check — only REVIEWER_ROLES may delete
//  2. Cannot delete the only remaining version
//  3. Cannot delete the latest (current) version
//  4. Cannot delete the approved version
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any

    // 1. Role check
    if (!REVIEWER_ROLES.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete spec versions.' },
        { status: 403 }
      )
    }

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      select: {
        id: true,
        approvedVersionId: true,
        versions: {
          orderBy: { version: 'desc' },
          select: { id: true, version: true },
        },
      },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const versions = spec.versions

    // 2. Cannot delete if only version
    if (versions.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only remaining version.' },
        { status: 400 }
      )
    }

    // 3. Cannot delete the current (latest) version
    const latestId = versions[0].id // sorted desc, so index 0 is latest
    if (params.versionId === latestId) {
      return NextResponse.json(
        { error: 'Cannot delete the current version. Generate or save a new version first.' },
        { status: 400 }
      )
    }

    // 4. Cannot delete the approved version
    if ((spec as any).approvedVersionId === params.versionId) {
      return NextResponse.json(
        { error: 'Cannot delete the approved version. Revoke approval before deleting.' },
        { status: 400 }
      )
    }

    // Delete — comments cascade via schema (onDelete: Cascade on PRDComment.specVersionId)
    await prisma.specVersion.delete({ where: { id: params.versionId } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
