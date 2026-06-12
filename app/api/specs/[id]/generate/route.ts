import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient, createAIClient } from '@/lib/ai/provider'
import { decrypt } from '@/lib/encryption'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Fallback hardcoded templates (used only when no promptId is supplied and
// the caller passes a legacy templateType string).
// ---------------------------------------------------------------------------
const FALLBACK_TEMPLATES: Record<string, string> = {
  FULL_PRD: `You are a senior product manager. Write a detailed PRD with these sections:
# {TITLE}
## Executive Summary
## Problem Statement
## Goals
## Non-Goals
## Business Requirements
## Solution Overview
## Functional Requirements
## Detailed Acceptance Criteria
## User Flows
## Edge Cases
## Dependencies
## Assumptions
## Success Metrics

Be specific and practical. No placeholder text.`,
  LIGHTWEIGHT_PRD: 'Write a concise PRD:\n# {TITLE}\n## Problem Statement\n## Goals\n## Functional Requirements\n## Acceptance Criteria',
  ENGINEERING_SPEC: 'Write a technical spec:\n# {TITLE}\n## Problem\n## Solution Overview\n## Technical Requirements\n## Data Model\n## API Changes\n## Dependencies\n## Acceptance Criteria',
  DISCOVERY_BRIEF: 'Write a discovery brief:\n# {TITLE}\n## Problem Hypothesis\n## User Research Questions\n## Success Signals\n## Assumptions to Validate',
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const generateSchema = z.object({
  promptId: z.string().optional(),            // DB-driven prompt (preferred)
  llmConfigId: z.string().optional(),
  templateType: z.string().optional(),        // legacy fallback
  additionalInstructions: z.string().optional(),
  featureDetails: z.string().optional(),      // primary feature context (from Create Spec dialog)
  versionName: z.string().optional(),
  contextFlags: z.object({
    includeRice: z.boolean().optional().default(true),
    includeJira: z.boolean().optional().default(true),
    includeDependencies: z.boolean().optional().default(true),
    includeNotes: z.boolean().optional().default(true),
  }).optional(),
})

// ---------------------------------------------------------------------------
// POST /api/specs/[id]/generate
// ---------------------------------------------------------------------------
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = generateSchema.parse(await req.json().catch(() => ({})))

    // ── Load spec + roadmap item ──────────────────────────────────────────
    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      include: {
        roadmapItem: {
          include: {
            dependenciesFrom: { include: { toItem: { select: { id: true, title: true } } } },
          },
        },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const item = spec.roadmapItem
    if (!item) return NextResponse.json({ error: 'No roadmap item linked' }, { status: 400 })

    // ── Resolve AI client ─────────────────────────────────────────────────
    let aiClient: any
    if (body.llmConfigId) {
      const config = await prisma.lLMConfig.findFirst({ where: { id: body.llmConfigId, organizationId: orgId } })
      if (config) {
        const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
        aiClient = createAIClient(config.provider.toLowerCase() as any, apiKey, config.defaultModel)
      }
    }
    if (!aiClient) aiClient = await getAIClient(orgId)

    // ── Build context string ──────────────────────────────────────────────
    const flags = body.contextFlags ?? {} as any
    const itemAny = item as any
    const contextParts: string[] = []

    // Feature Details goes first — it is the primary input describing what to build
    if (body.featureDetails) {
      contextParts.push(`Feature Details:\n${body.featureDetails}`)
      contextParts.push('---')
    }

    contextParts.push(`Feature Title: ${item.title}`)
    contextParts.push(`Category: ${item.category ?? 'N/A'}`)
    if (item.description) contextParts.push(`Background: ${item.description}`)
    if (item.targetQuarter) contextParts.push(`Target Quarter: ${item.targetQuarter}`)
    if (flags.includeRice !== false && item.riceReach > 0) {
      contextParts.push(
        `RICE Score: ${item.priorityScore} (Reach: ${item.riceReach}, Impact: ${item.riceImpact}, Confidence: ${item.riceConfidence}%, Effort: ${item.riceEffort} person-months)`
      )
    }
    if (flags.includeJira !== false && itemAny.jiraKey) {
      contextParts.push(`Jira Issue: ${itemAny.jiraKey}${itemAny.jiraStatus ? ` (${itemAny.jiraStatus})` : ''}`)
    }
    if (flags.includeDependencies !== false && itemAny.dependenciesFrom?.length > 0) {
      const deps = itemAny.dependenciesFrom
        .map((d: any) => `${d.relationshipType}: ${d.toItem.title}`)
        .join(', ')
      contextParts.push(`Dependencies: ${deps}`)
    }
    if (flags.includeNotes !== false && itemAny.notes) {
      contextParts.push(`PM Notes: ${itemAny.notes}`)
    }
    if (body.additionalInstructions) {
      contextParts.push(`Additional Instructions: ${body.additionalInstructions}`)
    }
    const contextBlock = contextParts.join('\n')

    // ── Resolve template ──────────────────────────────────────────────────
    let templateText: string
    let resolvedPromptId: string | undefined
    let resolvedPromptVersion: number | undefined
    let resolvedTemplateName: string

    if (body.promptId) {
      // DB-driven: fetch prompt record
      const dbPrompt = await prisma.prompt.findFirst({
        where: { id: body.promptId, organizationId: orgId },
      })
      if (!dbPrompt) {
        return NextResponse.json({ error: 'Prompt template not found' }, { status: 404 })
      }
      templateText = dbPrompt.templateText
      resolvedPromptId = dbPrompt.id
      resolvedPromptVersion = dbPrompt.version
      resolvedTemplateName = dbPrompt.name
    } else {
      // Legacy: use hardcoded template by templateType key
      const key = (body.templateType ?? 'FULL_PRD').toUpperCase()
      templateText = FALLBACK_TEMPLATES[key] ?? FALLBACK_TEMPLATES.FULL_PRD
      resolvedTemplateName = key
    }

    // Substitute placeholders — support both {{var}} and {VAR} styles
    const finalPrompt = templateText
      .replace(/\{\{title\}\}/gi, item.title)
      .replace(/\{TITLE\}/g, item.title)
      .replace(/\{\{context\}\}/gi, contextBlock)

    // ── Call LLM ──────────────────────────────────────────────────────────
    const result = await aiClient.complete({
      messages: [
        {
          role: 'system',
          content:
            'You are a senior product manager writing production-ready specs. Be specific and detailed. Avoid generic filler.',
        },
        {
          role: 'user',
          content: resolvedPromptId
            ? finalPrompt  // DB template already includes context via {{context}}
            : `Context:\n${contextBlock}\n\n${finalPrompt}`,  // legacy: prepend context
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    })

    // ── Persist version ───────────────────────────────────────────────────
    const newVersionNum = (spec.versions[0]?.version ?? 0) + 1
    const newVersion = await prisma.specVersion.create({
      data: {
        specId: spec.id,
        version: newVersionNum,
        versionName: (body as any).versionName?.trim() || `Version ${newVersionNum}`,
        contentMd: result.content,
        changedByUserId: session.user.id,
        changeSummary: `AI generated — ${resolvedTemplateName}`,
        provider: result.provider,
        model: result.model,
        generationMode: 'FRESH_DRAFT',
        generationScope: 'FULL_DOC',
        contextSnapshotJson: JSON.stringify({
          title: item.title,
          category: item.category,
          quarter: item.targetQuarter,
        }),
        additionalInstructions: body.featureDetails ?? body.additionalInstructions,
        // Provenance — stored even though Prisma types may not be up to date
        ...(resolvedPromptId && {
          promptTemplateId: resolvedPromptId,
          promptTemplateVersion: String(resolvedPromptVersion),
        }),
      } as any,
    })

    await prisma.spec.update({
      where: { id: spec.id },
      data: {
        contentMd: result.content,
        version: newVersionNum,
        generationMethod: 'AI_GENERATED',
        lifecycleState: 'DRAFT',
        templateType: resolvedTemplateName,
        ...(resolvedPromptId && { sourcePromptId: resolvedPromptId }),
      },
    })

    await prisma.roadmapItem.update({ where: { id: item.id }, data: { specStatus: 'DRAFT' } })
    await prisma.roadmapActivity.create({
      data: {
        roadmapItemId: item.id,
        specId: spec.id,
        eventType: 'prd_generated',
        actorName: session.user.name,
        metadataJson: JSON.stringify({
          versionId: newVersion.id,
          model: result.model,
          provider: result.provider,
          promptId: resolvedPromptId,
        }),
      },
    })

    return NextResponse.json({ version: newVersion, spec: { id: spec.id, version: newVersionNum } })
  } catch (e) {
    console.error('PRD generation error:', e)
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 })
  }
}
