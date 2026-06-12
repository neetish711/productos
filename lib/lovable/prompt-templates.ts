// ─── Lovable Prompt Template System ──────────────────────────────────────────
// Increment CURRENT_VERSION whenever the static blocks change so every
// PrototypePublish record can be traced back to the prompt template used.

export const CURRENT_PROMPT_TEMPLATE_VERSION = 1

// ─── Extraction system prompt ─────────────────────────────────────────────────
export const EXTRACTION_SYSTEM_PROMPT = `You are a UX analyst extracting structured frontend information from a Product Requirements Document (PRD).

Your job is to extract ONLY information relevant to building a frontend prototype. Ignore all business strategy, stakeholder justification, ROI, timelines, and non-UI content.

Return a single JSON object with this exact structure:
{
  "appType": "string — what kind of app this is (e.g. 'analytics dashboard', 'task management tool')",
  "primaryUserRole": "string — the main user persona",
  "appPurpose": "string — one sentence describing what this app does for the user",
  "navItems": ["array of sidebar/top-nav item names"],
  "screens": [
    {
      "name": "string",
      "purpose": "string — one line",
      "entryPoint": "string — how user gets here",
      "primaryActions": ["string"],
      "secondaryActions": ["string"]
    }
  ],
  "forms": [
    {
      "name": "string",
      "fields": [
        { "label": "string", "type": "text|select|date|toggle|number|textarea|email|password|file", "required": true }
      ],
      "submitLabel": "string",
      "cancelBehavior": "string"
    }
  ],
  "tables": [
    {
      "entity": "string",
      "columns": [{ "name": "string", "sortable": true, "filterable": false }],
      "rowActions": ["string"],
      "bulkActions": ["string"],
      "emptyStateMessage": "string"
    }
  ],
  "cards": [
    {
      "entity": "string",
      "shows": ["string"],
      "clickBehavior": "string"
    }
  ],
  "drawers": [
    {
      "name": "string",
      "trigger": "string",
      "tabs": ["string"],
      "primaryCta": "string",
      "secondaryCta": "string"
    }
  ],
  "dialogs": [
    {
      "name": "string",
      "trigger": "string",
      "isDestructive": false,
      "confirmLabel": "string"
    }
  ],
  "statusBadges": [
    {
      "field": "string",
      "values": [{ "label": "string", "color": "green|amber|red|blue|gray|violet" }]
    }
  ],
  "filters": [
    {
      "screen": "string",
      "filters": [{ "label": "string", "type": "multi-select|select|date-range|text" }]
    }
  ],
  "userFlows": [
    {
      "name": "string",
      "steps": ["string"]
    }
  ],
  "emptyStates": [
    {
      "screen": "string",
      "message": "string",
      "ctaLabel": "string"
    }
  ],
  "toasts": [
    { "trigger": "string", "type": "success|error|warning", "message": "string" }
  ],
  "integrationPlaceholders": ["string — name any external integrations that need placeholder UI"]
}

Return valid JSON only. If a section has no relevant data, return an empty array for that key.`

// ─── Static instruction block ─────────────────────────────────────────────────
export const STATIC_INSTRUCTION_BLOCK = `You are building a production-quality internal SaaS web application using React, TypeScript, and Tailwind CSS with shadcn/ui components. This is NOT a marketing page or landing page.

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
- Left sidebar navigation with icons and labels, top header with user menu`

// ─── Static closing rules ─────────────────────────────────────────────────────
export const STATIC_CLOSING_RULES = `QUALITY RULES — follow strictly:
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
- TypeScript types defined for all data entities`

// ─── Build extraction prompt ───────────────────────────────────────────────────
export function buildExtractionPrompt(prdContent: string): string {
  return `Extract the UI-relevant frontend information from this PRD.
Return structured JSON only — no prose, no markdown fences.

PRD CONTENT:
---
${prdContent}
---`
}

// ─── Assemble final Lovable prompt ────────────────────────────────────────────
export function assembleLovablePrompt(
  extracted: Record<string, any>,
  roadmapItem: { title: string; category: string; description: string },
  customInstructionBlock?: string,
): string {
  const parts: string[] = []

  parts.push(customInstructionBlock ?? `${STATIC_INSTRUCTION_BLOCK}\n\n${STATIC_CLOSING_RULES}`)
  parts.push('')

  parts.push(`APPLICATION: ${roadmapItem.title}`)
  parts.push(`CATEGORY: ${roadmapItem.category}`)
  if (extracted.appType) parts.push(`APP TYPE: ${extracted.appType}`)
  if (extracted.appPurpose) parts.push(`PURPOSE: ${extracted.appPurpose}`)
  if (extracted.primaryUserRole) parts.push(`PRIMARY USER: ${extracted.primaryUserRole}`)
  parts.push('')

  // Navigation
  if (extracted.navItems?.length) {
    parts.push('NAVIGATION STRUCTURE')
    parts.push('---')
    parts.push(`Sidebar links: ${extracted.navItems.join(', ')}`)
    parts.push('')
  }

  // Screens
  if (extracted.screens?.length) {
    parts.push('SCREENS TO BUILD')
    parts.push('---')
    for (const s of extracted.screens) {
      parts.push(`SCREEN: ${s.name}`)
      parts.push(`  Purpose: ${s.purpose}`)
      if (s.entryPoint) parts.push(`  Entry point: ${s.entryPoint}`)
      if (s.primaryActions?.length) parts.push(`  Primary actions: ${s.primaryActions.join(', ')}`)
      if (s.secondaryActions?.length) parts.push(`  Secondary actions: ${s.secondaryActions.join(', ')}`)
      parts.push('')
    }
  }

  // Data tables
  if (extracted.tables?.length) {
    parts.push('DATA TABLES')
    parts.push('---')
    for (const t of extracted.tables) {
      parts.push(`TABLE: ${t.entity}`)
      if (t.columns?.length) {
        parts.push(`  Columns: ${t.columns.map((c: any) => `${c.name}${c.sortable ? ' (sortable)' : ''}${c.filterable ? ' (filterable)' : ''}`).join(', ')}`)
      }
      if (t.rowActions?.length) parts.push(`  Row actions: ${t.rowActions.join(', ')}`)
      if (t.bulkActions?.length) parts.push(`  Bulk actions: ${t.bulkActions.join(', ')}`)
      if (t.emptyStateMessage) parts.push(`  Empty state: "${t.emptyStateMessage}"`)
      parts.push('')
    }
  }

  // Cards
  if (extracted.cards?.length) {
    parts.push('CARDS / GRIDS')
    parts.push('---')
    for (const c of extracted.cards) {
      parts.push(`CARD: ${c.entity}`)
      if (c.shows?.length) parts.push(`  Shows: ${c.shows.join(', ')}`)
      if (c.clickBehavior) parts.push(`  Click: ${c.clickBehavior}`)
      parts.push('')
    }
  }

  // Forms
  if (extracted.forms?.length) {
    parts.push('FORMS')
    parts.push('---')
    for (const f of extracted.forms) {
      parts.push(`FORM: ${f.name}`)
      if (f.fields?.length) {
        for (const field of f.fields) {
          parts.push(`  - ${field.label} (${field.type})${field.required ? ' [required]' : ''}`)
        }
      }
      if (f.submitLabel) parts.push(`  Submit: "${f.submitLabel}"`)
      if (f.cancelBehavior) parts.push(`  Cancel: ${f.cancelBehavior}`)
      parts.push('')
    }
  }

  // Drawers
  if (extracted.drawers?.length) {
    parts.push('DRAWERS / SHEETS')
    parts.push('---')
    for (const d of extracted.drawers) {
      parts.push(`DRAWER: ${d.name}`)
      if (d.trigger) parts.push(`  Trigger: ${d.trigger}`)
      if (d.tabs?.length) parts.push(`  Tabs: ${d.tabs.join(', ')}`)
      if (d.primaryCta) parts.push(`  Primary CTA: "${d.primaryCta}"`)
      if (d.secondaryCta) parts.push(`  Secondary CTA: "${d.secondaryCta}"`)
      parts.push('')
    }
  }

  // Dialogs
  if (extracted.dialogs?.length) {
    parts.push('MODALS / DIALOGS')
    parts.push('---')
    for (const d of extracted.dialogs) {
      parts.push(`DIALOG: ${d.name}`)
      if (d.trigger) parts.push(`  Trigger: ${d.trigger}`)
      if (d.isDestructive) parts.push('  Type: destructive confirmation')
      if (d.confirmLabel) parts.push(`  Confirm: "${d.confirmLabel}"`)
      parts.push('')
    }
  }

  // Filters
  if (extracted.filters?.length) {
    parts.push('FILTER BARS')
    parts.push('---')
    for (const fb of extracted.filters) {
      parts.push(`FILTER BAR: ${fb.screen}`)
      if (fb.filters?.length) {
        parts.push(`  Filters: ${fb.filters.map((f: any) => `${f.label} (${f.type})`).join(', ')}`)
      }
      parts.push('')
    }
  }

  // Status badges
  if (extracted.statusBadges?.length) {
    parts.push('STATUS BADGES')
    parts.push('---')
    for (const sb of extracted.statusBadges) {
      const vals = sb.values?.map((v: any) => `${v.label} (${v.color})`).join(', ') ?? ''
      parts.push(`${sb.field}: ${vals}`)
    }
    parts.push('')
  }

  // User flows
  if (extracted.userFlows?.length) {
    parts.push('KEY USER FLOWS')
    parts.push('---')
    extracted.userFlows.forEach((flow: any, i: number) => {
      parts.push(`Flow ${i + 1}: ${flow.name}`)
      if (flow.steps?.length) {
        flow.steps.forEach((step: string, j: number) => {
          parts.push(`  Step ${j + 1}: ${step}`)
        })
      }
      parts.push('')
    })
  }

  // Empty states
  if (extracted.emptyStates?.length) {
    parts.push('EMPTY STATES')
    parts.push('---')
    for (const es of extracted.emptyStates) {
      parts.push(`${es.screen}: "${es.message}" — CTA: "${es.ctaLabel}"`)
    }
    parts.push('')
  }

  // Toasts
  if (extracted.toasts?.length) {
    parts.push('FEEDBACK TOASTS')
    parts.push('---')
    for (const t of extracted.toasts) {
      parts.push(`${t.type.toUpperCase()} after "${t.trigger}": "${t.message}"`)
    }
    parts.push('')
  }

  // Integration placeholders
  if (extracted.integrationPlaceholders?.length) {
    parts.push('INTEGRATION PLACEHOLDERS (show as readonly UI elements)')
    parts.push('---')
    for (const ip of extracted.integrationPlaceholders) {
      parts.push(`- ${ip}`)
    }
    parts.push('')
  }

  // Closing rules only appended when using legacy static blocks (customInstructionBlock already contains them)
  if (!customInstructionBlock) {
    parts.push(STATIC_CLOSING_RULES)
  }

  return parts.join('\n')
}
