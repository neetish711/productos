import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const versions = await prisma.specVersion.findMany({
      where: { specId: params.id },
      include: {
        changedBy: { select: { name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { version: 'desc' },
    })
    return NextResponse.json(versions)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const { versionId, versionName } = await req.json()
    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.specVersion.update({
      where: { id: versionId },
      data: { versionName },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
