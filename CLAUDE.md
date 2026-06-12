# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ProductOS — a multi-tenant B2B SaaS for Product Managers to track features, monitor competitors, manage roadmaps, generate AI-powered specs, and ingest account intelligence. Supports role-based access control, multi-product workspaces, and admin-controlled user approval.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (next lint)
npm run db:push      # Push schema to DB without migration
npm run db:migrate   # Run Prisma migrations (prisma migrate dev)
npm run db:seed      # Seed demo data (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio GUI
npm run db:reset     # Reset DB + re-seed (destructive)
npx prisma generate  # Regenerate Prisma client after schema changes
npx tsx prisma/migrate-rbac.ts  # Run RBAC migration (sets permissions for existing users)
```

## Tech Stack

- **Next.js 14** App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Prisma** with SQLite (dev) — schema at `prisma/schema.prisma`
- **NextAuth.js** with credentials provider (JWT sessions)
- **Zustand** for client-side state (`store/`)
- **React Hook Form** + Zod for form validation
- **TanStack Table** v8 for data tables
- Multi-provider AI: OpenAI, Anthropic, Google Gemini via adapter pattern in `lib/ai/provider.ts`

## Architecture

### Route Groups (App Router)

- `app/(auth)/` — Login, Register, Request Access, Access Denied (public)
- `app/(onboarding)/` — 5-step onboarding wizard
- `app/(app)/` — Protected app shell with sidebar layout
- `app/(app)/admin/` — Admin panel (requests, users, products, permissions)
- `app/(app)/products/` — Product selection page
- `app/api/` — All API route handlers (CRUD + AI streaming + admin)

### Key Patterns

- **Path alias**: `@/*` maps to project root (e.g., `@/lib/db`, `@/components/ui`)
- **Org-scoped data**: Every DB query filters by `organizationId` from the session JWT. The session carries `id`, `role`, `status`, `organizationId`, `organizationSlug`, `onboardingCompleted`, and `permissions`.
- **Product-scoped data**: Dashboard and module queries filter by selected product via `lib/product-context.ts`. Selected product stored in cookie (`selectedProductId`). Use `getSelectedProductId()` and `getAccessibleProductIds()` for server components.
- **RBAC**: `lib/permissions.ts` defines 22 permissions across 6 modules. Roles: SUPER_ADMIN, ADMIN, PM, EDITOR, VIEWER. Admins bypass all permission checks. Use `hasPermission()` and `isAdmin()` helpers. Permissions stored as JSON array on User model (`permissionsJson`).
- **User status**: Users have `status` field: PENDING, APPROVED, REJECTED, DEACTIVATED. Only APPROVED users can log in. New access requests create PENDING users.
- **Auth middleware**: `middleware.ts` enforces auth on all routes except public paths. Admin routes restricted to SUPER_ADMIN/ADMIN roles.
- **AI provider abstraction**: `lib/ai/provider.ts` — factory pattern with `getAIClient(orgId)` that reads encrypted API keys from DB (falls back to env vars). Supports role-specific configs via `getAIClientForRole()`.
- **Encrypted API keys**: LLM keys stored with AES-256-GCM (`lib/encryption.ts`), decrypted server-side only.
- **Prisma singleton**: `lib/db/index.ts` — standard global singleton pattern for hot reload.
- **JSON-in-string columns**: Many Prisma models store arrays/objects as JSON strings (e.g., `tagsJson`, `variablesJson`, `permissionsJson`). Parse with `JSON.parse()` when reading.
- **UI components**: shadcn/ui primitives in `components/ui/`, domain components in `components/` subdirectories.
- **Workflow engine**: `lib/workflow-engine/` — sequential AI step runner with definitions and engine.
- **File parsers**: `lib/file-parsers/` — CSV, XLSX, PDF, DOCX parsing for feature import.
- **State stores**: `store/product.store.ts`, `store/spec.store.ts`, `store/ui.store.ts`, `store/workflow.store.ts` (Zustand).
- **Review workflow**: Specs support lifecycle states: DRAFT → SUBMITTED → APPROVED/REJECTED/CHANGES_REQUESTED. Permission-gated via `submit_for_review`, `approve_story`, `reject_story`.

### Auth Utilities (`lib/auth/utils.ts`)

- `getSession()` / `getOrgId()` — basic session access
- `requireAuth()` / `requireOrgSession()` — redirect to login if unauthenticated
- `requireAdmin()` — redirect to access-denied if not admin
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

### Environment

Requires `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `ENCRYPTION_SECRET` (exactly 32 chars). LLM API keys are optional in `.env` — primarily managed encrypted in DB via the UI.

### Database

SQLite in development. The Prisma schema has ~39 models including AccessRequest, UserProductAccess for RBAC. After any schema change, run `npx prisma generate` then `npm run db:push` or `npm run db:migrate`.
