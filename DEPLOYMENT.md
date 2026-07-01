# Deployment & Database Cutover (Supabase Postgres + Railway)

The app uses **PostgreSQL** (Prisma `provider = "postgresql"`). Data is hosted on
**Supabase**; the app is hosted on **Railway**. The build applies migrations
automatically (`prisma migrate deploy`), so a normal deploy provisions the schema.

## 1. Supabase connection string

Use the **Session pooler** (port `5432`, IPv4) — it works for both Prisma
migrations and the app runtime. The **direct** connection
(`db.<ref>.supabase.co:5432`) is **IPv6-only** and won't work from most CI/hosts.

Dashboard → **Project Settings → Database → Connection string → "Session pooler"**:

```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

For this project:
- `PROJECT_REF` = `aelmwmqkymlzixbtlljb`
- `REGION` = confirm in the dashboard (best guess: `ap-south-1`)
- The `@` in a password must be URL-encoded as `%40` (e.g. `p@ssword` → `p%40ssword`)

> Rotate the DB password after setup if it was ever shared in plaintext.

## 2. Apply the schema (one time)

The committed baseline migration lives in `prisma/migrations/0_init`. Run from a
machine that can reach Postgres port 5432 (your laptop, or let Railway do it):

```bash
# confirm connectivity + region (P1001 = wrong region or blocked port)
npx prisma migrate status

# create all tables in Supabase
npx prisma migrate deploy

# provision the super admin (reads SUPER_ADMIN_EMAIL; prints a generated password if unset)
npx tsx prisma/setup-super-admin.ts
```

## 3. Railway environment variables

On the Railway **app service → Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Supabase **session pooler** string above |
| `NEXTAUTH_SECRET` | 32+ char random |
| `NEXTAUTH_URL` | your Railway app URL |
| `ENCRYPTION_SECRET` | exactly 32 chars |
| `SUPER_ADMIN_EMAIL` | your admin email |
| `SUPER_ADMIN_PASSWORD` | optional — omit to have one generated + printed in deploy logs once |
| `CRON_SECRET` | random string |
| `CRAWL4AI_URL` | optional, your Crawl4AI service URL |
| `LLM_MONTHLY_TOKEN_BUDGET` | optional, e.g. `5000000` |
| `ENCRYPTION_SECRET_PREVIOUS` | optional, only during key rotation |

The build command already runs: `prisma generate && prisma migrate deploy && tsx prisma/setup-super-admin.ts && next build`
— so pushing to `main` migrates Supabase and boots. **Set `DATABASE_URL` before the first push** or the build fails.

## 4. Schedule the cron endpoints

Something must call these HTTP endpoints on a schedule with header
`x-cron-secret: <CRON_SECRET>` (Railway cron service, or an external scheduler):

- `POST /api/cron/workflow-drain` — every ~2 min (durable workflow worker + stale-run reaper)
- `POST /api/cron/competitor-refresh` — per your refresh cycle (e.g. daily)

## 5. Backups

Supabase provides automated daily backups (Pro plan) / PITR. Verify a restore.

## Notes
- SQLite is fully removed; there is no local dev DB. Point `DATABASE_URL` at Supabase
  (or a local Postgres) for local development too.
- All raw SQL was converted to typed Prisma, so the app is Postgres-clean.
