import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            changedBy: { select: { name: true } },
            _count: { select: { comments: true } },
          },
        },
        roadmapItem: true,
      },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(spec)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { contentMd, changeSummary, versionName, generationMode } = await req.json()
    const newVersionNum = spec.version + 1
    const [updated] = await prisma.$transaction([
      prisma.spec.update({
        where: { id: params.id },
        data: { contentMd, version: newVersionNum, generationMethod: 'MANUAL', lifecycleState: spec.lifecycleState === 'APPROVED' ? 'DRAFT' : spec.lifecycleState },
      }),
      prisma.specVersion.create({
        data: {
          specId: params.id,
          version: newVersionNum,
          versionName: versionName || `Version ${newVersionNum}`,
          contentMd,
          changedByUserId: session.user.id,
          changeSummary: changeSummary ?? 'Manual edit',
          generationMode: generationMode || 'MANUAL_EDIT',
        },
      }),
    ])
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const spec = await prisma.spec.findFirst({ where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } } })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.spec.delete({ where: { id: params.id } })
    if (spec.roadmapItemId) {
      await prisma.roadmapItem.update({ where: { id: spec.roadmapItemId }, data: { specStatus: 'NO_SPEC', specId: null } })
    }
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
