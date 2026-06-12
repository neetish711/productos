# ProductOS — Product Intelligence & Roadmap OS

A production-grade SaaS web application for B2B Product Managers to track features, monitor competitors, manage roadmaps, generate specs, and ingest account intelligence.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Prisma** + PostgreSQL
- **NextAuth.js** (credentials provider)
- **TanStack Table** v8
- **Zustand** (UI state)
- **React Hook Form** + Zod
- **CodeMirror 6** (markdown editor)
- **OpenAI / Anthropic / Gemini** SDKs
- **Recharts** (analytics charts)

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Setup

```bash
# 1. Install dependencies
cd productos
npm install

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_SECRET

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed demo data
npx tsx prisma/seed.ts

# 5. Start dev server
npm run dev
```

Open http://localhost:3000

### Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@acmecorp.com | demo1234 | Admin |
| pm@acmecorp.com | demo1234 | Member |

## Features

### Core Modules
- **Dashboard** — Stats, recent activity, AI suggestions banner
- **Our Features** — Full CRUD with category filtering and bulk actions
- **Competitors** — Card grid with feature inventory per competitor
- **Comparisons** — Feature pivot table (our features × competitors)
- **Battle Cards** — AI-generated or manual sales positioning cards
- **Key Updates** — Competitor change detection with PM action tracking
- **Roadmap** — Drag-drop reorder, RICE scoring, AI suggestions tab
- **Spec Library** — Versioned markdown specs with AI chat refinement
- **Accounts** — Account health tracking with update timeline
- **Prompts** — Prompt template management for all AI workflows
- **LLM Config** — Multi-provider API key management (encrypted)
- **Workflows** — Sequential AI workflow engine with step tracking
- **Settings** — Org settings, team management, usage analytics
- **Integrations** — Google Chat webhook integration

### AI Features
- Multi-provider support: OpenAI, Anthropic Claude, Google Gemini
- AES-256-GCM encrypted API key storage
- SSE streaming for spec refinement chat
- 15 default prompt templates
- AI roadmap suggestions from competitive gaps + account feedback
- AI spec generation from roadmap items

### Security
- Session-based auth (NextAuth.js JWT)
- Org-scoped data isolation on every query
- Encrypted LLM keys (key never exposed client-side)
- MIME-type validated file uploads (10MB limit)

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/productos"
NEXTAUTH_SECRET="your-32-char-secret"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_SECRET="exactly-32-characters-here!!!!!"

# Optional — LLM keys (can also be stored encrypted in DB via UI)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_AI_API_KEY=""
```

## Project Structure

```
app/
  (auth)/          # Login, Register pages
  (onboarding)/    # 5-step onboarding wizard
  (app)/           # Protected app shell
    dashboard/
    features/
    competitors/[id]/
    comparisons/
    battle-cards/
    key-updates/
    roadmap/ + ai-suggested/
    specs/[id]/     # SpecWorkspace with 5 tabs
    accounts/[id]/
    prompts/
    llm-config/
    workflows/ + history/
    settings/ + usage/
    integrations/
  api/             # API routes for all CRUD + AI streaming

components/
  ui/              # shadcn primitives
  layout/          # Sidebar, TopBar
  data-table/      # Generic TanStack Table
  spec/            # MarkdownEditor
  search/          # GlobalSearchDialog (Cmd+K)
  notifications/   # NotificationPanel
  onboarding/      # OnboardingWizard

lib/
  ai/              # Multi-provider AI abstraction
  auth/            # NextAuth config + utils
  db/              # Prisma + query helpers
  encryption.ts    # AES-256-GCM
  file-parsers/    # CSV, XLSX, PDF, DOCX
  workflow-engine/ # Sequential step runner

prisma/
  schema.prisma    # 23-entity schema
  seed.ts          # Demo data
```
