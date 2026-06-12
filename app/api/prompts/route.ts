import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

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

    // Ensure the 4 default spec-generation templates exist for this org
    if (!category || category === 'spec-generation') {
      for (const template of DEFAULT_SPEC_TEMPLATES) {
        const exists = await prisma.prompt.findFirst({
          where: { organizationId: orgId, category: 'spec-generation', name: template.name },
        })
        if (!exists) {
          await prisma.prompt.create({
            data: { ...template, organizationId: orgId },
          })
        }
      }
    }

    // Ensure the lovable-generation master prompt exists for this org
    if (!category || category === 'lovable-generation') {
      const exists = await prisma.prompt.findFirst({
        where: { organizationId: orgId, category: 'lovable-generation', name: DEFAULT_LOVABLE_TEMPLATE.name },
      })
      if (!exists) {
        await prisma.prompt.create({
          data: { ...DEFAULT_LOVABLE_TEMPLATE, organizationId: orgId },
        })
      }
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
    const orgId = await getOrgId()
    const body = schema.parse(await req.json())
    const prompt = await prisma.prompt.create({ data: { ...body, organizationId: orgId } })
    return NextResponse.json(prompt, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error('POST /api/prompts error:', e)
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
  }
}
