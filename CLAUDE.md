# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ProductOS — a multi-tenant B2B SaaS for Product Managers to track features, monitor competitors, manage roadmaps, generate AI-powered specs, and ingest account intelligence. Supports role-based access control, multi-product workspaces, admin-controlled user approval, and Crawl4AI-powered competitive intelligence.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also runs prisma generate + db push + super admin setup)
npm run lint         # ESLint (next lint)
npm run db:push      # Push schema to DB without migration
npm run db:migrate   # Run Prisma migrations (prisma migrate dev)
npm run db:seed      # Seed demo data (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio GUI
npm run db:reset     # Reset DB + re-seed (destructive)
npx prisma generate  # Regenerate Prisma client after schema changes
npx tsx prisma/migrate-rbac.ts     # Run RBAC migration (sets permissions for existing users)
npx tsx prisma/setup-super-admin.ts # Create/upgrade designated Super Admin
npx tsc --noEmit     # Type-check without emitting (no test framework is configured)
```

> No automated test framework (Jest/Vitest/Playwright) is set up. The only static checks are `npm run lint` and `npx tsc --noEmit`; verify changes by running the dev server.

## Tech Stack

- **Next.js 14** App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Prisma** with SQLite (dev) / PostgreSQL (prod) — schema at `prisma/schema.prisma`
- **NextAuth.js** with credentials provider (JWT sessions)
- **Zustand** for client-side state (`store/`)
- **React Hook Form** + Zod for form validation
- **TanStack Table** v8 for data tables
- Multi-provider AI: OpenAI, Anthropic, Google Gemini via adapter pattern in `lib/ai/provider.ts`
- **Crawl4AI** for real web crawling in competitor intelligence (`lib/crawler/crawl4ai.ts`)

## Architecture

### Route Groups (App Router)

- `app/(auth)/` — Login, Register, Request Access, Access Denied (public)
- `app/(onboarding)/` — 5-step onboarding wizard
- `app/(app)/` — Protected app shell with sidebar layout
- `app/(app)/admin/` — Admin panel (requests, users, products, permissions)
- `app/(app)/products/` — Product selection page
- `app/api/` — All API route handlers (CRUD + AI streaming + admin + crawl)

### Key Patterns

- **Path alias**: `@/*` maps to project root (e.g., `@/lib/db`, `@/components/ui`)
- **Org-scoped data**: Every DB query filters by `organizationId` from the session JWT. The session carries `id`, `role`, `status`, `organizationId`, `organizationSlug`, `onboardingCompleted`, and `permissions`.
- **Product-scoped data**: All modules (roadmap, features, competitors, accounts, specs, comparisons, battle cards) filter by selected product via `lib/product-context.ts`. Selected product stored in cookie (`selectedProductId`). Use `getSelectedProductId()` and `getAccessibleProductIds()` for server components. API routes read product from cookie via `getProductIdFromRequest(req)`.
- **RBAC**: `lib/permissions.ts` defines 25 permissions across 7 modules (Roadmap, Competitors, Specs, Features, Ideas, Review, Admin). Role hierarchy: SUPER_ADMIN (Level 1) > SENIOR_PM (Level 2) > PM (Level 3) > CSM/SALES/PSD/ENGINEERING (Level 4). Admin panel visible to SUPER_ADMIN, SENIOR_PM, PM. Use `hasPermission()`, `isAdmin()`, `canAccessAdminPanel()`, `canAssignRole()` helpers. Permissions stored as JSON array on User model (`permissionsJson`).
- **User status**: PENDING, APPROVED, REJECTED, DEACTIVATED. Only APPROVED users can log in. New registrations create PENDING users requiring admin approval.
- **Auth middleware**: `middleware.ts` enforces auth on all routes except public paths. Admin routes restricted to `ADMIN_PANEL_ROLES`.
- **AI provider abstraction**: `lib/ai/provider.ts` — factory pattern with `getAIClient(orgId)` that reads encrypted API keys from DB (falls back to env vars). Supports role-specific configs via `getAIClientForRole()`.
- **Encrypted API keys**: LLM keys stored with AES-256-GCM (`lib/encryption.ts`), decrypted server-side only.
- **Prisma singleton**: `lib/db/index.ts` — standard global singleton pattern for hot reload.
- **JSON-in-string columns**: Many Prisma models store arrays/objects as JSON strings (e.g., `tagsJson`, `variablesJson`, `permissionsJson`). Parse with `JSON.parse()` when reading.
- **UI components**: shadcn/ui primitives in `components/ui/`, domain components in `components/` subdirectories.
- **Loading states**: `loading.tsx` files per route + `NavigationProgress` component for top progress bar.
- **Workflow engine**: `lib/workflow-engine/` — sequential AI step runner. Required step failure → SKIPPED downstream. Optional step failure → continue. Preflight checks + idempotency. Two workflows: `COMPETITOR_DEEP_ANALYSIS` (6 steps), `COMPETITOR_REFRESH` (3 steps).
- **Crawl4AI integration**: `lib/crawler/crawl4ai.ts` — connects to self-hosted Crawl4AI Docker for real web crawling. Graceful fallback to simulated mode when unavailable. Used by crawl endpoints and workflow engine.
- **Source discovery**: After creating a competitor, `SourceDiscoveryWizard` auto-discovers sources via LLM, lets users review/approve, then batch-crawls approved sources.
- **File parsers**: `lib/file-parsers/` — CSV, XLSX, PDF, DOCX parsing for feature import.
- **State stores**: `store/product.store.ts`, `store/spec.store.ts`, `store/ui.store.ts`, `store/workflow.store.ts` (Zustand).
- **Review workflow**: Specs support lifecycle states: DRAFT → SUBMITTED → APPROVED/REJECTED/CHANGES_REQUESTED. Permission-gated via `submit_for_review`, `approve_story`, `reject_story`.
- **Prompt templates**: ~18 auto-seeded templates across 5 categories (spec-generation, competitive-intelligence, roadmap, account-intelligence, lovable-generation). Defined inline in `app/api/prompts/route.ts` and seeded per-org on first access via `GET /api/prompts` (idempotent upsert keyed by category + name).

### Auth Utilities (`lib/auth/utils.ts`)

- `getSession()` / `getOrgId()` — basic session access
- `requireAuth()` / `requireOrgSession()` — redirect to login if unauthenticated
- `requireAdmin()` — redirect to access-denied if not admin-panel role
- `requirePermission(key)` — redirect if missing specific permission
- `apiRequireAuth()` / `apiRequirePermission(key)` — API route helpers returning NextResponse

### Admin API Routes

- `POST/GET /api/access-requests` — create (public) / list (admin) access requests
- `PATCH /api/access-requests/[id]` — approve/reject with role + product assignment
- `GET /api/admin/users` — list org users with product access
- `PATCH/DELETE /api/admin/users/[id]` — update role/permissions/status, deactivate
- `GET/POST /api/admin/products` — list/create products
- `PATCH/DELETE /api/admin/products/[id]` — update/archive products
- `POST/DELETE /api/admin/products/[id]/users` — assign/remove user-product access

### Competitor Intelligence API

- `POST /api/competitors/[id]/managed-sources/discover` — LLM-based source discovery
- `POST /api/competitors/[id]/crawl-batch` — batch crawl approved sources via Crawl4AI
- `POST /api/competitors/[id]/managed-sources/[sourceId]/crawl` — crawl single source
- `GET /api/workflows/competitor/[competitorId]` — competitor workflow status + guidance
- `GET /api/workflows/runs/[runId]` — poll workflow run status per-step

### Environment

Requires `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `ENCRYPTION_SECRET` (exactly 32 chars). Optional: `CRAWL4AI_URL` for real web crawling, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for OAuth. LLM API keys optional in `.env` — primarily managed encrypted in DB via the UI.

### Database

SQLite in development (`file:./dev.db`). Prisma schema has 39 models including AccessRequest, UserProductAccess, Competitor (with `productId`), Account (with `productId`). After any schema change, run `npx prisma generate` then `npm run db:push`.

### Deployment (Railway)

- Build command: `prisma generate && prisma db push && tsx prisma/setup-super-admin.ts && next build`
- Super Admin (`nitish@redproduct.com`) auto-created on every build via `prisma/setup-super-admin.ts`
- Crawl4AI runs as separate Railway service, connected via `CRAWL4AI_URL` env var (internal networking)
- SQLite is ephemeral on Railway — data resets on redeploy. PostgreSQL available but requires fixing raw SQL queries for compatibility.
