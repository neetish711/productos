import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { linkGithub, updateItemPrototypeFields, getLatestPublish } from '@/lib/lovable/db'

const schema = z.object({
  publishId: z.string(),
  githubRepoUrl: z.string().url('Must be a valid URL'),
  githubBranch: z.string().min(1, 'Branch name required'),
  githubCommitRef: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
      select: { id: true, specId: true },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = schema.parse(await req.json())

    await linkGithub(body.publishId, body.githubRepoUrl, body.githubBranch, body.githubCommitRef ?? null)
    await updateItemPrototypeFields(params.id, {
      prototypeStatus: 'GITHUB_LINKED',
      githubRepoUrl: body.githubRepoUrl,
      githubBranch: body.githubBranch,
      githubCommitRef: body.githubCommitRef ?? null,
    })

    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: params.id,
        specId: item.specId ?? undefined,
        eventType: 'prototype_github_linked',
        actorType: 'USER',
        metadataJson: JSON.stringify({
          publishId: body.publishId,
          githubRepoUrl: body.githubRepoUrl,
          githubBranch: body.githubBranch,
        }),
      },
    })

    const updated = await getLatestPublish(params.id)
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
