import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'

interface SourceSuggestion {
  url: string
  sourceType: string
  label: string
  priority: string
  rationale: string
}

// Pattern-based fallback discovery (no LLM needed)
function patternBasedDiscovery(domain: string): SourceSuggestion[] {
  const base = `https://${domain}`
  return [
    { url: base, sourceType: 'WEBSITE', label: 'Main Website', priority: 'HIGH', rationale: 'Primary product website — core features and messaging' },
    { url: `${base}/pricing`, sourceType: 'PRICING', label: 'Pricing Page', priority: 'HIGH', rationale: 'Pricing tiers and packaging details' },
    { url: `${base}/docs`, sourceType: 'DOCS', label: 'Documentation', priority: 'NORMAL', rationale: 'Technical documentation reveals feature depth' },
    { url: `${base}/blog`, sourceType: 'BLOG', label: 'Blog', priority: 'NORMAL', rationale: 'Announcements, thought leadership, and roadmap signals' },
    { url: `${base}/changelog`, sourceType: 'RELEASE_NOTES', label: 'Changelog', priority: 'HIGH', rationale: 'Product updates and release history' },
    { url: `${base}/integrations`, sourceType: 'INTEGRATIONS', label: 'Integrations', priority: 'NORMAL', rationale: 'Ecosystem and integration partners' },
    { url: `${base}/security`, sourceType: 'TRUST', label: 'Security & Trust', priority: 'LOW', rationale: 'Compliance posture and certifications' },
  ]
}

// POST /api/competitors/[id]/managed-sources/discover
export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
      select: { id: true, name: true, website: true },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Extract domain from website or fall back to name-based guess
    let domain = ''
    if (competitor.website) {
      try {
        domain = new URL(competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`).hostname.replace(/^www\./, '')
      } catch { /* ignore */ }
    }

    if (!domain) {
      // Try LLM or simple pattern on name
      return NextResponse.json({
        suggestions: [],
        message: 'No website URL configured for this competitor. Please set a website first.',
      })
    }

    // Try LLM-based discovery first
    let suggestions: SourceSuggestion[] = []

    const MAX_LLM_ATTEMPTS = 2
    for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS && suggestions.length === 0; attempt++) {
      try {
        const ai = await getAIClient(orgId)
        if (ai) {
          const prompt = `You are a competitive intelligence analyst. Given the company "${competitor.name}" with domain "${domain}", suggest 8-10 specific source URLs to monitor for competitive intelligence.

You MUST respond with a valid JSON array. Each element must be an object with exactly these fields:
- "url": string — a full, valid URL starting with https:// (e.g. "https://${domain}/pricing")
- "sourceType": string — one of: "WEBSITE", "DOCS", "PRICING", "RELEASE_NOTES", "BLOG", "TRUST", "INTEGRATIONS", "GITHUB", "REDDIT", "YOUTUBE", "PRODUCT_HUNT", "NEWS", "CUSTOM"
- "label": string — short human-readable name (2-4 words)
- "priority": string — one of: "HIGH", "NORMAL", "LOW"
- "rationale": string — 1 sentence explaining what competitive signal this URL provides

Example format:
[{"url":"https://${domain}/pricing","sourceType":"PRICING","label":"Pricing Page","priority":"HIGH","rationale":"Tracks pricing changes and packaging updates."}]

Focus on sources most likely to reveal: feature changes, pricing moves, integration partners, compliance posture, and market positioning.

Respond with the JSON array only. No markdown, no explanation.`

          const response = await ai.complete({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            maxTokens: 1500,
            jsonMode: true,
          } as any)

          const text = response.content?.trim() ?? ''
          let parsedArr: unknown
          try {
            parsedArr = JSON.parse(text)
          } catch {
            const jsonMatch = text.match(/\[[\s\S]*\]/)
            if (jsonMatch) parsedArr = JSON.parse(jsonMatch[0])
          }

          if (Array.isArray(parsedArr) && parsedArr.length > 0) {
            // Validate URLs and filter out invalid entries
            const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i
            const validated = (parsedArr as SourceSuggestion[]).filter(s =>
              s.url && urlRegex.test(s.url) && s.sourceType && s.label
            )
            if (validated.length > 0) {
              suggestions = validated
            }
          }
        }
      } catch (llmErr) {
        console.warn(`[managed-sources/discover] LLM attempt ${attempt + 1} failed:`, llmErr instanceof Error ? llmErr.message : llmErr)
        // Retry or fall through to pattern-based
      }
    }

    if (suggestions.length === 0) {
      suggestions = patternBasedDiscovery(domain)
    }

    // Filter out already-added sources
    const existingSources = await prisma.competitorSource.findMany({
      where: { competitorId: params.id },
      select: { url: true },
    })
    const existingUrls = new Set(existingSources.map((s) => s.url.replace(/\/$/, '').toLowerCase()))
    suggestions = suggestions.filter((s) => !existingUrls.has(s.url.replace(/\/$/, '').toLowerCase()))

    return NextResponse.json({ suggestions, domain })
  } catch (e) {
    console.error('[managed-sources/discover]', e)
    return NextResponse.json({ error: 'Error discovering sources' }, { status: 500 })
  }
}
