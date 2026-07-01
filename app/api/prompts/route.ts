import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'
import { z } from 'zod'

// AUDIT S2-5: prompt templates are used org-wide in every AI generation, so
// writes are restricted to admin-panel roles (prevents prompt-injection by any
// approved user). Reading/seeding via GET stays open to authenticated users.
async function requirePromptAdminOrgId() {
  const session = await getServerSession(authConfig)
  if (!session?.user || !canAccessAdminPanel(session.user.role)) return null
  return session.user.organizationId
}

// ---------------------------------------------------------------------------
// Default spec-generation templates — seeded on first access per org
// ---------------------------------------------------------------------------
const DEFAULT_SPEC_TEMPLATES = [
  {
    category: 'spec-generation',
    name: 'Full PRD',
    description: 'Comprehensive product requirements document with all major sections.',
    templateText: `You are a senior product manager writing a production-ready PRD. Use the context below to write a detailed, specific product requirements document.

Feature: {{title}}

{{context}}

Write a full PRD with the following sections:

# {{title}}

## Summary
Brief overview of the feature, its business value, and the expected impact on users and the product.

## Problem Statement
Describe the problem this feature solves. Who is affected, how often, and what is the current workaround or pain point?

## Goals
List 3–5 specific, measurable goals. What does success look like 30/60/90 days after launch?

## Business Requirements
Key business constraints, compliance needs, SLAs, commercial requirements, or stakeholder mandates.

## Functional Requirements
Numbered list of specific, testable requirements. Each should start with "The system shall…"

## Acceptance Criteria
Cover the happy path, edge cases, and error states. Use numbered or Gherkin-style criteria (Given / When / Then).

## Edge Cases & Error States
List potential edge cases, what triggers them, and how the system should respond to each.

## Dependencies
Technical, team, or external dependencies. Flag any blockers or delivery risks.

## Assumptions
State all assumptions made. Each assumption should be validated before build begins.

## Success Metrics
Specific KPIs and how they will be measured post-launch. Include baseline values where known.

Be specific and practical. Replace all section descriptions with real content based on the feature context. No filler text.`,
    variablesJson: JSON.stringify(['title', 'context']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'spec-generation',
    name: 'Half Baked PRD',
    description: 'Lightweight PRD for quick planning and early-stage feature definition.',
    templateText: `You are a product manager writing a concise, actionable PRD for an early-stage feature. Keep each section tight and focused. No filler.

Feature: {{title}}

{{context}}

Write a lightweight PRD:

# {{title}}

## Summary
1–2 sentences: what is this feature and why does it matter?

## Problem Statement
2–3 sentences: what problem does this solve, who is affected, and how often?

## Proposed Solution
Brief description of the intended approach. What are we building?

## Key Requirements
Numbered list of the core requirements only. Stick to must-haves — skip nice-to-haves.

## Basic Acceptance Criteria
The minimum criteria that must be met for this feature to be considered done and shippable.

## Open Questions
Any unresolved questions that could block or change the design before work begins.

Keep the entire document concise and direct. This is a working doc, not a final spec.`,
    variablesJson: JSON.stringify(['title', 'context']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'spec-generation',
    name: 'Technical Document',
    description: 'Technical implementation-oriented document for engineering and architecture planning.',
    templateText: `You are a senior engineer writing a technical specification. Focus on system behavior, architecture, data design, and implementation details — not user stories.

Feature: {{title}}

{{context}}

Write a technical document:

# {{title}} — Technical Document

## Technical Summary
What is being built at a technical level? Summarize the system changes in 2–3 sentences.

## Architecture & System Behavior
- Components involved and how they interact
- Data flow (describe end-to-end in plain text or pseudo-diagram)
- Key architectural decisions and trade-offs

## API & Integration Considerations
For each new or modified endpoint or integration:
- Method + path (or integration point)
- Request/response schema (TypeScript types preferred)
- Auth requirements and error codes

## Data Considerations
- New or modified database tables, fields, indexes, constraints
- Data types, nullability, defaults, and cardinality
- Migration or backfill requirements

## Dependencies & Constraints
External services, internal services, libraries, or infrastructure this relies on. Note any hard constraints.

## Implementation Notes
Suggested implementation order, rollout strategy, feature flag plan, and backward-compatibility considerations.

## Risks
Technical risks, unknowns, or areas of high complexity that need early investigation.

Be precise. Use concrete types and values wherever possible. This document should be sufficient for a senior engineer to begin scoping.`,
    variablesJson: JSON.stringify(['title', 'context']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'spec-generation',
    name: 'Discovery Brief',
    description: 'Early discovery template for problem framing, research inputs, and next steps.',
    templateText: `You are a product manager writing a discovery brief for early-stage research. Focus entirely on problem framing — do not propose solutions yet.

Feature: {{title}}

{{context}}

Write a discovery brief:

# {{title}} — Discovery Brief

## Opportunity / Problem
In one paragraph: what opportunity or problem have we identified and why does it matter now?

## Background & Context
What do we already know? Include any relevant data, prior research, customer signals, or competitive context.

## Hypotheses
List 3–5 hypotheses to validate. Format each as:
"We believe [assumption]. We'll know we're right when [observable evidence]."

## User & Business Pain Points
- Who experiences this problem? (personas, segments, company sizes)
- In what context does the problem occur? (workflow, trigger, frequency)
- What is the cost of the problem? (lost revenue, churn, support load, inefficiency)

## Research Questions
What must we learn before we can confidently define a solution? List 5–10 specific, open-ended questions.

## Assumptions
What are we assuming to be true that, if wrong, would change the direction? Rank by risk level.

## Next Steps
- Recommended research methods (user interviews, survey, data analysis, prototype test, etc.)
- Suggested participant profile or data sources
- Proposed owner and rough timeline

Do not propose specific solutions or implementation approaches. This is a problem-framing document only.`,
    variablesJson: JSON.stringify(['title', 'context']),
    isDefault: true,
    isActive: true,
  },
]

// ---------------------------------------------------------------------------
// Default competitive intelligence prompts — seeded on first access per org
// ---------------------------------------------------------------------------
const DEFAULT_CI_TEMPLATES = [
  {
    category: 'competitive-intelligence',
    name: 'Competitor Report Writer',
    description: 'Generates a comprehensive 13-section competitive intelligence report from features, sources, and updates.',
    templateText: `You are a senior competitive intelligence analyst writing for Product Managers at a B2B SaaS company.

Write a comprehensive competitive intelligence report on {{competitorName}} based on the evidence provided below.

## Evidence & Context
{{context}}

## Report Structure — Write ALL 13 Sections

### 1. Executive Summary
3–5 sentence overview: who is this competitor, their core value prop, key recent moves, and the single biggest thing our PM team should know.

### 2. Company & Product Positioning
How do they position themselves in market? What verticals, company sizes, and personas do they target? How does their messaging differ from ours?

### 3. Product Capabilities
Feature-by-feature breakdown organized by category. For each feature: what it does, how mature it is (GA/Beta/Early), and how it compares to our equivalent.

### 4. Pricing & Packaging
Known pricing tiers, packaging model (per-seat, usage-based, flat), free tier, and any recent pricing changes. Note confidence level if data is incomplete.

### 5. Security & Compliance
Known certifications (SOC2, ISO 27001, HIPAA, GDPR), security features, audit capabilities, and data residency options.

### 6. Ecosystem & Developer Readiness
API quality, SDK availability, integrations marketplace, developer docs quality, and community/open-source footprint.

### 7. Community & Market Sentiment
What are users saying on G2, Reddit, HackerNews, Product Hunt? Summarize positive themes and complaints. Include NPS or satisfaction scores if known.

### 8. Historical Changes
Timeline of significant product changes, launches, pivots, or acquisitions in the last 12 months.

### 9. Competitive Comparison
Direct comparison against our product across 5–10 key dimensions. Use a clear format: Dimension | Us | Them | Verdict.

### 10. Risks & Unknowns
What don't we know? What could change? Flag low-confidence assessments and areas needing deeper investigation.

### 11. PM Takeaways
5 actionable recommendations for our product team based on this analysis.

### 12. Sales / GTM Takeaways
5 actionable talking points, objection handlers, or positioning suggestions for sales and marketing.

### 13. Evidence Appendix
List all sources used, confidence ratings, and dates accessed.

Be specific, cite evidence where available, and flag confidence levels (HIGH/MEDIUM/LOW) for each major claim.`,
    variablesJson: JSON.stringify(['competitorName', 'context']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Source Discovery',
    description: 'Suggests monitoring URLs for a competitor based on their website and product.',
    templateText: `You are a competitive intelligence analyst. Given a competitor named "{{competitorName}}" with website "{{website}}", suggest 8–10 URLs to monitor for competitive intelligence.

For each URL, provide:
- url: The full URL
- sourceType: One of WEBSITE, DOCS, PRICING, BLOG, RELEASE_NOTES, INTEGRATIONS, TRUST, GITHUB, REDDIT, YOUTUBE, PRODUCT_HUNT, NEWS
- label: A short label (e.g., "Pricing Page", "GitHub Repo")
- priority: HIGH, NORMAL, or LOW
- rationale: Why this source is valuable (1 sentence)

Return a JSON array. Focus on official sources first, then community and third-party.

Example output:
[
  { "url": "https://example.com/pricing", "sourceType": "PRICING", "label": "Pricing Page", "priority": "HIGH", "rationale": "Track pricing changes and packaging updates" }
]`,
    variablesJson: JSON.stringify(['competitorName', 'website']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Evidence Extractor',
    description: 'Extracts product features and competitive signals from source content.',
    templateText: `You are a competitive intelligence analyst extracting product features from web content.

Competitor: {{competitorName}}
Source URL: {{sourceUrl}}
Source Content:
{{content}}

Extract 2–5 competitive signals from this content. For each signal, provide:
1. **Feature Name**: A concise name for the capability or update
2. **Category**: Classify into one of: AI Core, Automation, Governance, Channel, Admin, Deployment, Integrations, Analytics, Security, Pricing, Other
3. **Description**: 2–3 sentences describing what it does and why it matters
4. **Confidence**: HIGH (explicit claim), MEDIUM (inferred), or LOW (speculation)
5. **Evidence Snippet**: The exact quote or paragraph from the source

Return as a JSON array:
[{ "name": "...", "category": "...", "description": "...", "confidence": "...", "evidenceSnippet": "..." }]

Only extract real product capabilities or changes. Skip marketing fluff, team bios, or generic content.`,
    variablesJson: JSON.stringify(['competitorName', 'sourceUrl', 'content']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Change Detector',
    description: 'Identifies recent product changes and competitive updates from available intelligence.',
    templateText: `You are a competitive intelligence analyst specializing in detecting product changes.

Competitor: {{competitorName}}
Recent Features:
{{features}}

Recent Source Updates:
{{sourceUpdates}}

Based on the data above, identify 3–5 recent or likely product changes. For each change:
1. **Title**: Short descriptive title
2. **Change Type**: One of: FEATURE_LAUNCHED, FEATURE_REMOVED, PRICING_CHANGED, INTEGRATION_ADDED, AI_MESSAGING_CHANGED, COMPLIANCE_CHANGED, RELEASE_PUBLISHED, DOCS_UPDATED, EXEC_SIGNAL
3. **Description**: 2–3 sentences describing the change and its competitive significance
4. **Significance**: HIGH, MEDIUM_HIGH, MEDIUM, or LOW
5. **Evidence**: What data supports this inference?

Return as a JSON array. Be realistic — only flag changes that are well-supported by the data. Do not speculate wildly.`,
    variablesJson: JSON.stringify(['competitorName', 'features', 'sourceUpdates']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Battle Card Synthesizer',
    description: 'Generates a sales-ready battle card for competitive positioning.',
    templateText: `You are a competitive intelligence analyst creating a sales-ready battle card.

Our Product: {{ourProduct}}
Competitor: {{competitorName}}

Our Key Features:
{{ourFeatures}}

Competitor Key Features:
{{competitorFeatures}}

Recent Competitor Updates:
{{recentUpdates}}

Generate a comprehensive battle card with these sections:

## Strengths (vs {{competitorName}})
List 3–5 areas where we are clearly ahead. Be specific with evidence.

## Weaknesses (vs {{competitorName}})
List 2–3 areas where the competitor is ahead. Be honest — sales needs to know.

## Key Differentiators
3–5 unique capabilities or approaches that set us apart.

## Improvement Opportunities
Areas where we could close the gap or leapfrog the competitor.

## Sales Messaging
- **Elevator pitch** (2 sentences): Why choose us over {{competitorName}}?
- **Top 3 objection handlers**: Common competitor claims and our response
- **Deal-winning talking points**: 3 facts/features that win deals against this competitor

## PM Takeaways
3 actionable recommendations for the product team.

Be direct, specific, and evidence-based. This will be used in live sales conversations.`,
    variablesJson: JSON.stringify(['ourProduct', 'competitorName', 'ourFeatures', 'competitorFeatures', 'recentUpdates']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Community Signals Analyzer',
    description: 'Generates search queries and analyzes community sentiment for a competitor.',
    templateText: `You are a competitive intelligence analyst analyzing community sentiment.

Competitor: {{competitorName}}
Product Category: {{productCategory}}

Generate 5 search queries to find community discussions about this competitor on Reddit, HackerNews, Product Hunt, and G2. Queries should target:
1. Recent product experiences and reviews
2. Migration stories (to or from this competitor)
3. Feature requests and complaints
4. Pricing discussions
5. Comparison threads against alternatives

Return as a JSON array of strings:
["query1", "query2", ...]

Then provide a sentiment analysis template:
## Sentiment Analysis for {{competitorName}}

### Positive Themes
(What users consistently praise)

### Negative Themes
(Common complaints and frustrations)

### Feature Requests
(What users wish the product had)

### Migration Signals
(Signs users are considering switching — to or from)

### Net Sentiment
Overall: POSITIVE / MIXED / NEGATIVE with confidence level`,
    variablesJson: JSON.stringify(['competitorName', 'productCategory']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Gap Analysis',
    description: 'Identifies feature gaps between our product and competitors to inform the roadmap.',
    templateText: `You are a product strategist analyzing competitive gaps.

Our Features:
{{ourFeatures}}

Competitor Features (across all tracked competitors):
{{competitorFeatures}}

Identify the top 5 feature gaps — capabilities that competitors have that we lack or are behind on.

For each gap:
1. **Gap Title**: Concise name
2. **Description**: What the capability is and why it matters
3. **Competitors Who Have It**: Which competitors offer this
4. **Impact Assessment**: How much this gap affects win rates, retention, or market positioning (HIGH/MEDIUM/LOW)
5. **Effort Estimate**: Rough T-shirt size to close the gap (S/M/L/XL)
6. **Recommended Priority**: Should we prioritize this? Why or why not?
7. **Suggested Roadmap Item**: A one-line roadmap item title

Return as a JSON array for programmatic processing.`,
    variablesJson: JSON.stringify(['ourFeatures', 'competitorFeatures']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Feature Comparison',
    description: 'Compares a specific feature between our product and a competitor.',
    templateText: `You are a product analyst comparing features between two products.

Our Feature: {{ourFeature}}
Competitor: {{competitorName}}
Competitor Features: {{competitorFeatures}}

Provide a detailed comparison:

## Positioning
Overall: AHEAD | BEHIND | PARTIAL | EQUIVALENT | NO_MATCH

## Similarities
What capabilities do both products share?

## Differences
Where do the products diverge? Be specific about functionality, UX, and depth.

## Enhancement Opportunities
What could we add or improve to strengthen our position?

## Key Takeaways
3 bullet points summarizing the competitive dynamic for this feature area.

Return the positioning as a JSON object:
{ "positioning": "AHEAD|BEHIND|PARTIAL|EQUIVALENT|NO_MATCH", "similarities": "...", "differences": "...", "enhancementOpportunities": "...", "keyTakeaways": "..." }`,
    variablesJson: JSON.stringify(['ourFeature', 'competitorName', 'competitorFeatures']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Executive Summary Writer',
    description: 'Writes a concise 3-sentence executive summary from a full intelligence report.',
    templateText: `You are a senior analyst writing an executive summary.

Full Report:
{{reportContent}}

Write exactly 3 sentences:
1. Who is this competitor and what is their primary value proposition?
2. What is the single most important recent change or trend?
3. What is the #1 action our product team should take in response?

Be direct, specific, and actionable. No filler words.`,
    variablesJson: JSON.stringify(['reportContent']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'competitive-intelligence',
    name: 'Report Quality Reviewer',
    description: 'Reviews and critiques a competitive intelligence report for completeness and accuracy.',
    templateText: `You are a senior competitive intelligence reviewer auditing a report for quality.

Report:
{{reportContent}}

Evidence Sources Available: {{sourceCount}}
Features Tracked: {{featureCount}}

Review the report and provide:

## Completeness Score: X/10
How many of the 13 standard sections are meaningfully filled?

## Confidence Assessment
For each major claim in the report, rate confidence:
- HIGH: Multiple corroborating sources
- MEDIUM: Single source or reasonable inference
- LOW: Speculation or outdated data

## Gaps & Weaknesses
List specific areas where the report is thin, speculative, or missing evidence.

## Recommendations
What additional research or sources would most improve this report?

## Overall Quality: STRONG | ADEQUATE | NEEDS_IMPROVEMENT | INSUFFICIENT`,
    variablesJson: JSON.stringify(['reportContent', 'sourceCount', 'featureCount']),
    isDefault: true,
    isActive: true,
  },
]

// ---------------------------------------------------------------------------
// Default workflow prompts — for roadmap and account intelligence
// ---------------------------------------------------------------------------
const DEFAULT_WORKFLOW_TEMPLATES = [
  {
    category: 'roadmap',
    name: 'Roadmap Suggestions from Competitor Gaps',
    description: 'Generates AI-suggested roadmap items based on competitive gap analysis.',
    templateText: `You are a product strategist. Based on the competitive gaps identified below, suggest 3–5 concrete roadmap items.

Our Features:
{{ourFeatures}}

Competitor Gaps:
{{gaps}}

For each suggestion:
1. **Title**: A clear, actionable roadmap item title
2. **Description**: 2–3 sentences on what to build and why
3. **Category**: Feature area (e.g., AI Core, Integrations, Analytics)
4. **Priority Rationale**: Why this should be prioritized (competitive pressure, customer demand, strategic positioning)
5. **RICE Estimate**: Rough estimates — Reach (1-10), Impact (1-3), Confidence (0-100%), Effort (person-months)

Return as a JSON array.`,
    variablesJson: JSON.stringify(['ourFeatures', 'gaps']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'roadmap',
    name: 'RICE Score Estimator',
    description: 'Estimates RICE prioritization scores for a roadmap item based on context.',
    templateText: `You are a product prioritization expert using the RICE framework.

Feature: {{title}}
Description: {{description}}
Category: {{category}}
Target Quarter: {{quarter}}

Estimate RICE scores:
- **Reach**: How many users/accounts will this impact per quarter? (1-10 scale, where 10 = all users)
- **Impact**: How much will this move the needle for each user? (0.25 = minimal, 0.5 = low, 1 = medium, 2 = high, 3 = massive)
- **Confidence**: How confident are we in these estimates? (10-100%)
- **Effort**: How many person-months to build? (0.5-12)

Return as JSON:
{ "reach": N, "impact": N, "confidence": N, "effort": N, "score": N, "rationale": "..." }

The RICE score = (Reach × Impact × Confidence) / Effort`,
    variablesJson: JSON.stringify(['title', 'description', 'category', 'quarter']),
    isDefault: true,
    isActive: true,
  },
  {
    category: 'account-intelligence',
    name: 'Account Health Analyzer',
    description: 'Analyzes account health signals from meeting notes and support interactions.',
    templateText: `You are a customer success analyst reviewing account health signals.

Account: {{accountName}}
Recent Meeting Notes:
{{meetingNotes}}

Recent Support Interactions:
{{supportInteractions}}

Feature Requests:
{{featureRequests}}

Provide an account health assessment:

## Health Status: HEALTHY | AT_RISK | CRITICAL
One sentence justification.

## Key Signals
- **Positive signals**: What's going well?
- **Risk signals**: What's concerning?
- **Churn indicators**: Any signs of potential churn?

## Feature Impact
Which of their feature requests, if addressed, would most improve retention?

## Recommended Actions
3 specific actions for the CSM team to take in the next 30 days.

## Sentiment: POSITIVE | NEUTRAL | NEGATIVE
Overall sentiment trend based on recent interactions.`,
    variablesJson: JSON.stringify(['accountName', 'meetingNotes', 'supportInteractions', 'featureRequests']),
    isDefault: true,
    isActive: true,
  },
]

// ---------------------------------------------------------------------------
// Default lovable-generation template — seeded on first access per org
// ---------------------------------------------------------------------------
const DEFAULT_LOVABLE_TEMPLATE = {
  category: 'lovable-generation',
  name: 'Lovable Master Prompt',
  description: 'Master instruction block used when generating Lovable prompts from approved PRDs. Defines design principles and output requirements for frontend prototype generation.',
  templateText: `You are building a production-quality internal SaaS web application using React, TypeScript, and Tailwind CSS with shadcn/ui components. This is NOT a marketing page or landing page.

Design principles:
- Every screen must be functional, not decorative
- Data tables must use a proper table component with sortable columns and pagination
- Forms must show real field types (select dropdowns, date pickers, toggles, textareas)
- Status badges must use consistent color semantics: green=success/active, amber=warning/in-progress, red=error/blocked, blue=informational, gray=neutral/draft, violet=special
- Every empty state must include an icon, a descriptive message, and an action button
- Loading states must use skeleton components, not spinners alone
- All drawers/sheets must open from the right side at approximately 520px width
- Navigation active state must be visually distinct (colored left border or background)
- Use a clean professional design: white/light gray background, subtle borders, no gradients, no hero illustrations
- Desktop-first layout, functional on tablet
- Left sidebar navigation with icons and labels, top header with user menu

QUALITY RULES — follow strictly:
- Do NOT generate Lorem Ipsum — use realistic mock data relevant to the app type
- Do NOT build a landing page, marketing site, or hero section
- Every button must have a real interaction: open drawer, submit form, navigate, or show toast
- Use consistent spacing: p-4 for cards, px-6 for page padding, gap-4 for grid layouts
- Typography: text-sm for body, text-xs for metadata, text-base for headings
- All modals must be closeable with both a close button and pressing Escape
- Form validation errors must appear inline below the relevant field
- All tables must include a search input and at least one filter
- The application must feel complete, not like a wireframe
- Include at least 3–5 realistic mock data rows in every table
- All status badges must be consistently colored across all screens

OUTPUT REQUIREMENTS:
- Multi-page React app with client-side routing
- Each screen as a separate route/page component
- Shared layout component with sidebar navigation and top header
- No external API calls — use static mock data arrays defined at the top of each file
- Fully functional interactions using React local state
- TypeScript types defined for all data entities`,
  variablesJson: JSON.stringify([]),
  isDefault: true,
  isActive: true,
}

// ---------------------------------------------------------------------------
// GET /api/prompts[?category=...]
// Ensures the 4 spec-generation defaults exist per org (idempotent upsert by name).
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    // AUDIT S2-10: seed defaults with an atomic upsert on the (org, category, name)
    // unique key. The previous findFirst-then-create was non-atomic, so two
    // concurrent first-loads for a fresh org both created duplicates. `update: {}`
    // leaves any user-edited copy untouched.
    const seedPrompt = (template: { category: string; name: string } & Record<string, unknown>) =>
      prisma.prompt.upsert({
        where: {
          organizationId_category_name: {
            organizationId: orgId,
            category: template.category,
            name: template.name,
          },
        },
        create: { ...(template as any), organizationId: orgId },
        update: {},
      })

    const toSeed = [
      ...DEFAULT_SPEC_TEMPLATES,
      ...DEFAULT_CI_TEMPLATES,
      ...DEFAULT_WORKFLOW_TEMPLATES,
      DEFAULT_LOVABLE_TEMPLATE,
    ].filter((t) => !category || category === t.category)

    for (const template of toSeed) {
      await seedPrompt(template as any)
    }

    const prompts = await prisma.prompt.findMany({
      where: { organizationId: orgId, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(prompts)
  } catch (e) {
    console.error('GET /api/prompts error:', e)
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/prompts — create a new prompt
// ---------------------------------------------------------------------------
const schema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  templateText: z.string().min(1),
  variablesJson: z.union([z.array(z.string()), z.string()]).transform((v) =>
    typeof v === 'string' ? v : JSON.stringify(v)
  ).default('[]'),
  isActive: z.boolean().default(true),
})

export async function POST(req: Request) {
  try {
    const orgId = await requirePromptAdminOrgId()
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = schema.parse(await req.json())
    const prompt = await prisma.prompt.create({ data: { ...body, organizationId: orgId } })
    return NextResponse.json(prompt, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error('POST /api/prompts error:', e)
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
  }
}
