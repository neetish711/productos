import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient, createAIClient } from '@/lib/ai/provider'
import { decrypt } from '@/lib/encryption'
import { z } from 'zod'

const regenSchema = z.object({
  parentVersionId: z.string(),
  commentIds: z.array(z.string()).optional().default([]),
  sections: z.array(z.string()).optional(),
  llmConfigId: z.string().optional(),
  additionalInstructions: z.string().optional(),
  versionName: z.string().optional(),
  sectionLocks: z.record(z.enum(['LOCKED', 'REFINE', 'REGENERATE'])).optional().default({}),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = regenSchema.parse(await req.json())

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      include: { roadmapItem: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parentVersion = await prisma.specVersion.findFirst({
      where: { id: body.parentVersionId, specId: spec.id },
      include: { comments: { where: { status: 'OPEN' } } },
    })
    if (!parentVersion) return NextResponse.json({ error: 'Parent version not found' }, { status: 404 })

    let aiClient: any
    if (body.llmConfigId) {
      const config = await prisma.lLMConfig.findFirst({ where: { id: body.llmConfigId, organizationId: orgId } })
      if (config) {
        const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
        aiClient = createAIClient(config.provider.toLowerCase() as any, apiKey, config.defaultModel)
      }
    }
    if (!aiClient) aiClient = await getAIClient(orgId)

    const selectedComments = body.commentIds.length > 0
      ? parentVersion.comments.filter((c) => body.commentIds.includes(c.id))
      : parentVersion.comments.filter((c) => c.includeInRegeneration)

    const revisionBlock = selectedComments.map((c) =>
      `[Section: ${c.sectionName || 'General'}] Issue: ${c.issueType} | Feedback: ${c.body} | Anchored to: "${c.anchorText.slice(0, 100)}"`
    ).join('\n')

    const item = spec.roadmapItem
    const contextParts: string[] = []
    if (item) {
      contextParts.push(`Feature: ${item.title}`, `Category: ${item.category}`)
      if (item.description) contextParts.push(`Description: ${item.description}`)
    }

    const systemPrompt = `You are a senior product manager revising a PRD based on reviewer feedback. Improve the PRD addressing all feedback points. Preserve sections with no comments. Do not regress or remove content from sections not mentioned in feedback.`
    const userPrompt = `Original PRD:\n${parentVersion.contentMd}\n\n---\n\nFeedback to address:\n${revisionBlock || 'No specific comments — do a general quality pass.'}\n\n${body.additionalInstructions ? `Additional instructions: ${body.additionalInstructions}` : ''}\n\nWrite the full revised PRD:`

    const result = await aiClient.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    })

    const newVersionNum = (spec.versions[0]?.version ?? 0) + 1
    const isSectionRegen = body.sections && body.sections.length > 0
    const newVersion = await prisma.specVersion.create({
      data: {
        specId: spec.id,
        version: newVersionNum,
        versionName: (body as any).versionName?.trim() || `Version ${newVersionNum}`,
        contentMd: result.content,
        changedByUserId: session.user.id,
        changeSummary: `Regenerated from v${parentVersion.version} (${selectedComments.length} comments)`,
        provider: result.provider,
        model: result.model,
        generationMode: 'REGENERATION',
        generationScope: isSectionRegen ? 'MULTI_SECTION' : 'FULL_DOC',
        parentVersionId: body.parentVersionId,
        commentsApplied: selectedComments.length,
        sectionsRegeneratedJson: JSON.stringify(body.sections || []),
        additionalInstructions: body.additionalInstructions,
      } as any,
    })

    await prisma.spec.update({
      where: { id: spec.id },
      data: { contentMd: result.content, version: newVersionNum, lifecycleState: 'DRAFT' },
    })
    if (item) {
      await prisma.roadmapItem.update({ where: { id: item.id }, data: { specStatus: 'DRAFT' } })
      await prisma.roadmapActivity.create({
        data: { roadmapItemId: item.id, specId: spec.id, eventType: 'prd_version_regenerated', actorName: session.user.name, metadataJson: JSON.stringify({ newVersionId: newVersion.id, parentVersionId: body.parentVersionId, commentsApplied: selectedComments.length, model: result.model }) },
      })
    }

    return NextResponse.json({ version: newVersion, spec: { id: spec.id, version: newVersionNum } })
  } catch (e) {
    console.error('Regen error:', e)
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Regeneration failed' }, { status: 500 })
  }
}
