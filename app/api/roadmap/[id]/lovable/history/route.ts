import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getPublishHistory, getItemPrototypeFields } from '@/lib/lovable/db'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
      select: { id: true, specStatus: true, specId: true },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [history, protoFields] = await Promise.all([
      getPublishHistory(params.id),
      getItemPrototypeFields(params.id),
    ])

    return NextResponse.json({
      specStatus: item.specStatus,
      prototypeStatus: protoFields?.prototypeStatus ?? 'NONE',
      lovableProjectUrl: protoFields?.lovableProjectUrl ?? null,
      githubRepoUrl: protoFields?.githubRepoUrl ?? null,
      githubBranch: protoFields?.githubBranch ?? null,
      engineeringHandoffStatus: protoFields?.engineeringHandoffStatus ?? 'NOT_STARTED',
      prototypeIterationCount: protoFields?.prototypeIterationCount ?? 0,
      lastPublishedAt: protoFields?.lastPublishedAt ?? null,
      history,
    })
  } catch (e: any) {
    console.error('[lovable/history]', e)
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
