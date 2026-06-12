import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { transformPrdToLovablePrompt } from '@/lib/lovable/prd-transformer'
import {
  createPrototypePublish,
  getNextPublishVersion,
  updateItemPrototypeFields,
  supersedePreviousPublishes,
} from '@/lib/lovable/db'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId  = await getOrgId()
    const session = await getServerSession(authConfig)
    const userId  = session?.user?.id ?? null
    const userName = session?.user?.name ?? session?.user?.email ?? 'Unknown'

    // Verify ownership
    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, product: { organizationId: orgId } },
      select: { id: true, title: true, description: true, category: true, specId: true, specStatus: true },
    })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    // G1 — only approved specs
    if (item.specStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only items with an approved spec can be published to Lovable. Approve the spec first.' },
        { status: 409 },
      )
    }
    if (!item.specId) {
      return NextResponse.json({ error: 'No spec linked to this item' }, { status: 409 })
    }

    // Load the approved spec — use the latest version's content
    const spec = await prisma.spec.findUnique({
      where: { id: item.specId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    })
    if (!spec) return NextResponse.json({ error: 'Spec not found' }, { status: 404 })
    if (spec.lifecycleState !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Spec lifecycle state must be APPROVED before publishing.' },
        { status: 409 },
      )
    }

    const latestVersion = spec.versions[0]
    if (!latestVersion) return NextResponse.json({ error: 'No spec content found' }, { status: 409 })

    // Run the PRD → Lovable transformation
    const result = await transformPrdToLovablePrompt(
      latestVersion.contentMd,
      { title: item.title, category: item.category, description: item.description },
      orgId,
    )

    // Create PrototypePublish record (G2 — immutable snapshot)
    const publishVersion = await getNextPublishVersion(params.id)
    const publish = await createPrototypePublish({
      roadmapItemId: params.id,
      publishVersion,
      sourcePrdVersionId: latestVersion.id,
      sourcePrdVersionNum: latestVersion.version,
      lovablePromptSnapshot: result.prompt,
      lovablePromptVersion: result.promptVersion,
      extractionModel: result.model,
      extractionProvider: result.provider,
      publishedByUserId: userId,
      publishedByName: userName,
    })

    // Supersede older active publishes
    if (publishVersion > 1) {
      await supersedePreviousPublishes(params.id, publish.id)
    }

    // Update item prototype fields
    await updateItemPrototypeFields(params.id, {
      prototypeStatus: 'PUBLISHING',
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: userId,
      sourcePrdVersionId: latestVersion.id,
      prototypeIterationCount: publishVersion - 1,
    })

    // Log activity
    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: params.id,
        specId: item.specId,
        eventType: 'prototype_prompt_generated',
        actorId: userId ?? undefined,
        actorName: userName,
        actorType: 'USER',
        metadataJson: JSON.stringify({
          publishId: publish.id,
          publishVersion,
          specVersionId: latestVersion.id,
          specVersion: latestVersion.version,
          promptVersion: result.promptVersion,
          model: result.model,
        }),
      },
    })

    return NextResponse.json({
      publishId: publish.id,
      publishVersion,
      prompt: result.prompt,
      specVersion: latestVersion.version,
      specVersionId: latestVersion.id,
    })
  } catch (e: any) {
    console.error('[lovable/prepare]', e)
    return NextResponse.json({ error: e.message ?? 'Error' }, { status: 500 })
  }
}
