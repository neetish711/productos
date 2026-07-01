---
name: deploy
description: Build, test, verify prompts, and deploy ProductOS to Railway. Use when the user says "/deploy", "ship it", "deploy to production", or asks to release the current branch. Runs static checks, validates that all prompt templates are present and parseable, then pushes to origin/main which triggers the Railway build.
---

# Deploy ProductOS

ProductOS deploys to **Railway**, which auto-builds on push to `origin/main`
(`https://github.com/neetish711/productos.git`). Railway runs the `build` script
from `package.json`: `prisma generate && prisma db push && tsx prisma/setup-super-admin.ts && next build`.

Run these steps **in order**. If any step fails, STOP and report the failure — do
not push a broken build. Treat every step as a blocker.

## 1. Preflight

- Confirm the working tree state: `git status --short` and `git branch --show-current`.
- If there are uncommitted changes, list them and ask the user whether to commit them
  (with a message) or abort. Never push a dirty tree silently.
- Confirm the current branch is the one the user intends to ship (usually `main`).

## 2. Build

Run the same steps Railway will run, so a broken build is caught locally first:

```bash
npx prisma generate      # regenerate client (schema may have changed)
npx tsc --noEmit         # type-check — no test framework exists, this is the safety net
npm run lint             # ESLint (next lint)
npm run build            # full production build (prisma db push + setup-super-admin + next build)
```

If `tsc`, `lint`, or `build` errors, STOP and surface the exact output.

> Note: `npm run build` runs `prisma db push` against `DATABASE_URL`. Locally this
> targets `dev.db` (SQLite) — safe. Do not point it at a production DB from your machine.

## 3. Verify prompts (blocker — do not skip)

Prompt templates are defined inline in `app/api/prompts/route.ts` and seeded per-org on
first access via `GET /api/prompts`. A missing or unparseable template silently breaks the
app's core AI features, so validate them explicitly:

- Confirm the templates file parses (covered by `tsc --noEmit` above).
- Count the seeded templates and their categories, and confirm none regressed:

```bash
grep -oE "category: '[a-z-]+'" app/api/prompts/route.ts | sort | uniq -c
```

Expected categories: `spec-generation`, `competitive-intelligence`, `roadmap`,
`account-intelligence`, `lovable-generation` (~18 templates total). Every template object
must have `name`, `category`, and a non-empty prompt body. If the count dropped or a
category vanished versus the last deploy, STOP and report it before pushing.

## 4. Deploy

Only after steps 1–3 pass clean:

```bash
git push origin main
```

This triggers the Railway build. Report the push result and remind the user to watch the
Railway dashboard for build status.

## 5. Report

Give a concise summary:
- What was committed/pushed (commit hash + message).
- Results of tsc / lint / build (pass/fail).
- Prompt verification result (category counts).
- Next action: monitor Railway build; SQLite data resets on redeploy (ephemeral) — flag if
  that matters for this release.
