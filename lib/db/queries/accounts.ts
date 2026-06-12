'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function getAccounts(orgId: string) {
  return prisma.account.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { updates: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function getAccount(id: string, orgId: string) {
  return prisma.account.findFirst({
    where: { id, organizationId: orgId },
    include: {
      updates: { orderBy: { createdAt: 'desc' } },
      _count: { select: { updates: true } },
    },
  })
}

const createSchema = z.object({
  name: z.string().min(1),
  healthStatus: z.enum(['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED']).default('NEW'),
  csmName: z.string().default(''),
  csmEmail: z.string().email().optional().or(z.literal('')),
  meetingCadence: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).default('MONTHLY'),
  notesText: z.string().default(''),
  risksText: z.string().default(''),
  openAsksText: z.string().default(''),
})

export async function createAccount(orgId: string, data: z.infer<typeof createSchema>) {
  const parsed = createSchema.parse(data)
  const account = await prisma.account.create({
    data: { ...parsed, organizationId: orgId, csmEmail: parsed.csmEmail || null },
  })
  revalidatePath('/accounts')
  return account
}

export async function updateAccount(id: string, orgId: string, data: Partial<z.infer<typeof createSchema>>) {
  const existing = await prisma.account.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) throw new Error('Account not found')
  const account = await prisma.account.update({ where: { id }, data })
  revalidatePath(`/accounts/${id}`)
  return account
}

export async function deleteAccount(id: string, orgId: string) {
  const existing = await prisma.account.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) throw new Error('Account not found')
  await prisma.account.delete({ where: { id } })
  revalidatePath('/accounts')
}

const updateSchema = z.object({
  summaryText: z.string().default(''),
  feedbackText: z.string().default(''),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED']).default('NEUTRAL'),
  urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
  sourceType: z.enum(['MANUAL', 'CHAT_INTEGRATION', 'CSM_INPUT', 'IMPORTED_REPORT']).default('MANUAL'),
  featureRequestsJson: z.array(z.string()).default([]),
  issuesJson: z.array(z.string()).default([]),
  recurringConcernsJson: z.array(z.string()).default([]),
})

export async function createAccountUpdate(accountId: string, orgId: string, data: z.infer<typeof updateSchema>) {
  const account = await prisma.account.findFirst({ where: { id: accountId, organizationId: orgId } })
  if (!account) throw new Error('Account not found')
  const parsed = updateSchema.parse(data)
  const update = await prisma.accountUpdate.create({
    data: {
      accountId,
      summaryText: parsed.summaryText,
      feedbackText: parsed.feedbackText,
      sentiment: parsed.sentiment,
      urgencyLevel: parsed.urgencyLevel,
      sourceType: parsed.sourceType,
      featureRequestsJson: parsed.featureRequestsJson,
      issuesJson: parsed.issuesJson,
      recurringConcernsJson: parsed.recurringConcernsJson,
    } as any,
  })
  revalidatePath(`/accounts/${accountId}`)
  return update
}
