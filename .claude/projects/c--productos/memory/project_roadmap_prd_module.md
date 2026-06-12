---
name: AI Copilot Roadmap & PRD Workspace implementation
description: Major feature implementation covering roadmap import, PRD generation, inline comments, versioning, and lifecycle management
type: project
---

## What was built (completed March 2026)

Full implementation of the AI Copilot Roadmap & PRD Workspace as defined in the product specification documents.

### Schema additions (prisma/schema.prisma)
- `ImportJob` — tracks file import jobs (PDF/CSV/Excel)
- `RoadmapActivity` — audit trail for all roadmap and PRD events
- `RoadmapDependency` — item relationships (DEPENDS_ON, BLOCKED_BY, RELATED_TO, PARENT_EPIC, CHILD_ENHANCEMENT)
- `PRDComment` — inline text-anchored comments on SpecVersion records
- `RoadmapItem` updated: added jiraKey, jiraStatus, jiraLastSyncAt, duplicatedFromId, notes, specStatus, isDraft
- `Spec` updated: added lifecycleState, approvedByUserId, approvedAt, approvedVersionId, reviewDueDate, handoffStatus, templateType
- `SpecVersion` updated: added versionName, provider, model, promptTemplateVersion, parentVersionId, generationScope, generationMode, commentsApplied, contextSnapshotJson, etc.
- `User` updated: added prdComments relation
- `Product` updated: added importJobs relation

### New API routes
- `POST /api/roadmap/parse-file` — parse CSV/Excel/PDF, return headers + suggested mapping
- `POST /api/roadmap/import` — save mapped rows as RoadmapItems
- `POST /api/roadmap/[id]/duplicate` — duplicate a roadmap item
- `GET/POST /api/roadmap/[id]/activity` — audit trail
- `GET/POST/DELETE /api/roadmap/[id]/dependencies` — item relationships
- `POST /api/specs/[id]/generate` — AI PRD generation with template + LLM selection
- `POST /api/specs/[id]/regenerate` — AI regeneration using selected comments
- `GET/POST /api/specs/[id]/comments` — inline PRD comments
- `PATCH/DELETE /api/specs/[id]/comments/[commentId]` — comment mutations
- `GET/PATCH /api/specs/[id]/versions` — version list and rename
- `POST /api/specs/[id]/approve` — lifecycle transitions (SUBMIT_REVIEW, APPROVE, REQUEST_REVISION, ARCHIVE)
- `GET /api/specs/[id]/export` — export PRD as markdown

### New UI components
- `components/roadmap/ImportDialog.tsx` — 4-step import flow (upload → map columns → review → done)
- `components/roadmap/ItemDetailPanel.tsx` — full item detail Sheet with Details/Spec/Dependencies/History tabs
- `components/spec/GenerationDialog.tsx` — 4-step PRD generation (configure → preview → generating → done)
- `components/spec/CommentPanel.tsx` — right-side comment list with issue type, severity, resolve/delete
- `components/spec/RegenerationDialog.tsx` — pre-regen summary + comment selection + regen trigger
- `components/spec/VersionHistory.tsx` — version cards with inline renaming

### Overhauled pages
- `app/(app)/roadmap/_client.tsx` — full rewrite: 9-column table, multi-select bulk actions, filters, pagination/infinite scroll toggle, inline editing, ImportDialog, ItemDetailPanel
- `app/(app)/roadmap/page.tsx` — updated to pass llmConfigs
- `app/(app)/specs/[id]/_client.tsx` — full rewrite: 3-mode workspace (Read/Review/Edit), TOC sidebar, comment panel, text selection for commenting, version history sheet, lifecycle actions
- `app/(app)/specs/[id]/page.tsx` — updated to pass llmConfigs and new version fields

### Spec status values (specStatus on RoadmapItem)
NO_SPEC → DRAFT → UNDER_REVIEW → APPROVED → NEEDS_REVISION → ARCHIVED

### PRD lifecycle states (lifecycleState on Spec)
DRAFT → IN_REVIEW → APPROVED / NEEDS_REVISION → ARCHIVED

### Generation modes (generationMode on SpecVersion)
FRESH_DRAFT, REGENERATION, MANUAL_EDIT, MIXED

### Template types (templateType on Spec)
FULL_PRD, LIGHTWEIGHT_PRD, ENGINEERING_SPEC, DISCOVERY_BRIEF
