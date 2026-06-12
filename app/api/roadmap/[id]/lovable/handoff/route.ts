import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { markHandedOff, updateItemPrototypeFields, getLatestPublish } from '@/lib/lovable/db'

const schema = z.object({
  publishId: z.string(),
  action: z.enum(['READY', 'IN_PROGRESS', 'COMPLETED']),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId  = await getOrgId()
    const session = await getServerSession(authConfig)
    const userId  = session?.user?.id ?? null
    const userName = session?.user?.name ?? session?.user?.email ?? 'System'

    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
      select: { id: true, specId: true },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = schema.parse(await req.json())

    const latestPublish = await getLatestPublish(params.id)

    // G6 — GitHub must be linked before READY
    if (body.action === 'READY') {
      if (!latestPublish?.githubRepoUrl || !latestPublish?.githubBranch) {
        return NextResponse.json(
          { error: 'GitHub repo and branch must be linked before marking ready for engineering.' },
          { status: 409 },
        )
      }
      await markHandedOff(body.publishId)
    }

    const statusMap: Record<string, string> = {
      READY: 'READY_FOR_ENGINEERING',
      IN_PROGRESS: 'ENGINEERING_IN_PROGRESS',
      COMPLETED: 'NONE',
    }
    const handoffMap: Record<string, string> = {
      READY: 'READY',
      IN_PROGRESS: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
    }

    await updateItemPrototypeFields(params.id, {
      prototypeStatus: statusMap[body.action],
      engineeringHandoffStatus: handoffMap[body.action],
    })

    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: params.id,
        specId: item.specId ?? undefined,
        eventType: 'prototype_handoff_marked',
        actorId: userId ?? undefined,
        actorName: userName,
        actorType: 'USER',
        metadataJson: JSON.stringify({ action: body.action, publishId: body.publishId }),
      },
    })

    const updated = await getLatestPublish(params.id)
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
