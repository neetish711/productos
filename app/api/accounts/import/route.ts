import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { resolveProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'

// AUDIT S4-acct: bulk account import with duplicate detection by name (mirrors
// the features import). Previously accounts could only be added one-by-one.
const rowSchema = z.object({
  name: z.string().min(1),
  healthStatus: z.enum(['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED']).optional(),
  csmName: z.string().optional(),
  csmEmail: z.union([z.string().email(), z.literal('')]).optional(),
  meetingCadence: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).optional(),
  notesText: z.string().optional(),
})
const bodySchema = z.object({ accounts: z.array(rowSchema).max(1000) })

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const { accounts } = bodySchema.parse(await req.json())
    const productId = await resolveProductIdFromRequest(req)

    // Existing names (lowercased) for dedup.
    const existing = await prisma.account.findMany({
      where: { organizationId: orgId },
      select: { name: true },
    })
    const seen = new Set(existing.map((a) => a.name.toLowerCase()))

    let created = 0
    let skipped = 0
    const skippedNames: string[] = []

    for (const row of accounts) {
      const key = row.name.trim().toLowerCase()
      if (!key || seen.has(key)) {
        skipped++
        if (row.name) skippedNames.push(row.name)
        continue
      }
      seen.add(key) // guard against duplicates within the same batch too
      await prisma.account.create({
        data: {
          organizationId: orgId,
          ...(productId ? { productId } : {}),
          name: row.name.trim(),
          healthStatus: row.healthStatus ?? 'NEW',
          csmName: row.csmName ?? '',
          csmEmail: row.csmEmail || null,
          meetingCadence: row.meetingCadence ?? 'MONTHLY',
          notesText: row.notesText ?? '',
        },
      })
      created++
    }

    return NextResponse.json({ created, skipped, skippedNames: skippedNames.slice(0, 20) })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
