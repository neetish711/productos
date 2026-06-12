import { getAIClient } from '@/lib/ai/provider'
import { prisma } from '@/lib/db'
import {
  EXTRACTION_SYSTEM_PROMPT,
  CURRENT_PROMPT_TEMPLATE_VERSION,
  STATIC_INSTRUCTION_BLOCK,
  STATIC_CLOSING_RULES,
  buildExtractionPrompt,
  assembleLovablePrompt,
} from './prompt-templates'

export interface TransformResult {
  prompt: string
  extractionJson: string
  promptVersion: number
  model: string
  provider: string
  masterPromptId: string | null
  masterPromptVersion: number | null
}

async function getActiveLovablePrompt(orgId: string): Promise<{ id: string; templateText: string } | null> {
  try {
    const row = await prisma.prompt.findFirst({
      where: { organizationId: orgId, category: 'lovable-generation', isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, templateText: true },
    })
    return row ?? null
  } catch {
    return null
  }
}

export async function transformPrdToLovablePrompt(
  prdContentMd: string,
  roadmapItem: { title: string; category: string; description: string },
  orgId: string,
): Promise<TransformResult> {
  const [aiClient, masterPrompt] = await Promise.all([
    getAIClient(orgId),
    getActiveLovablePrompt(orgId),
  ])

  const extractionResult = await aiClient.complete({
    model: aiClient.defaultModel,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildExtractionPrompt(prdContentMd) },
    ],
    jsonMode: true,
  })

  let extracted: Record<string, any> = {}
  try {
    extracted = JSON.parse(extractionResult.content)
  } catch {
    extracted = {
      appType: roadmapItem.category,
      appPurpose: roadmapItem.description,
      primaryUserRole: 'Product Manager',
      navItems: [],
      screens: [],
      forms: [],
      tables: [],
      cards: [],
      drawers: [],
      dialogs: [],
      statusBadges: [],
      filters: [],
      userFlows: [],
      emptyStates: [],
      toasts: [],
      integrationPlaceholders: [],
    }
  }

  // Use DB prompt if available, otherwise fall back to hardcoded static blocks
  const instructionBlock = masterPrompt?.templateText ?? `${STATIC_INSTRUCTION_BLOCK}\n\n${STATIC_CLOSING_RULES}`
  const prompt = assembleLovablePrompt(extracted, roadmapItem, instructionBlock)

  return {
    prompt,
    extractionJson: extractionResult.content,
    promptVersion: CURRENT_PROMPT_TEMPLATE_VERSION,
    model: aiClient.defaultModel,
    provider: (aiClient as any).provider ?? 'unknown',
    masterPromptId: masterPrompt?.id ?? null,
    masterPromptVersion: masterPrompt ? 1 : null,
  }
}
