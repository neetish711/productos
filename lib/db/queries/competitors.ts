'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function getCompetitors(orgId: string) {
  return prisma.competitor.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { features: true, keyUpdates: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function getCompetitor(id: string, orgId: string) {
  return prisma.competitor.findFirst({
    where: { id, organizationId: orgId },
    include: {
      features: {
        include: { sourceEvidence: true },
        orderBy: { updatedAt: 'desc' },
      },
      keyUpdates: { orderBy: { detectedAt: 'desc' }, take: 10 },
      _count: { select: { features: true, keyUpdates: true } },
    },
  })
}

const createSchema = z.object({
  name: z.string().min(1),
  website: z.string().default(''),
  description: z.string().default(''),
  monitoringEnabled: z.boolean().default(true),
  refreshFrequencyDays: z.number().default(15),
})

export async function createCompetitor(orgId: string, data: z.infer<typeof createSchema>) {
  const parsed = createSchema.parse(data)
  const competitor = await prisma.competitor.create({
    data: { ...parsed, organizationId: orgId },
  })
  revalidatePath('/competitors')
  return competitor
}

const updateSchema = createSchema.partial()

export async function updateCompetitor(id: string, orgId: string, data: z.infer<typeof updateSchema>) {
  const existing = await prisma.competitor.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) throw new Error('Competitor not found')
  const competitor = await prisma.competitor.update({ where: { id }, data: updateSchema.parse(data) })
  revalidatePath('/competitors')
  return competitor
}

export async function deleteCompetitor(id: string, orgId: string) {
  const existing = await prisma.competitor.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) throw new Error('Competitor not found')
  await prisma.competitor.delete({ where: { id } })
  revalidatePath('/competitors')
}

export async function getCompetitorFeatures(competitorId: string, orgId: string) {
  const competitor = await prisma.competitor.findFirst({ where: { id: competitorId, organizationId: orgId } })
  if (!competitor) throw new Error('Competitor not found')
  return prisma.competitorFeature.findMany({
    where: { competitorId },
    include: { sourceEvidence: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createCompetitorFeature(competitorId: string, orgId: string, data: {
  name: string; description?: string; category?: string;
}) {
  const competitor = await prisma.competitor.findFirst({ where: { id: competitorId, organizationId: orgId } })
  if (!competitor) throw new Error('Competitor not found')
  const feature = await prisma.competitorFeature.create({
    data: { competitorId, name: data.name, description: data.description ?? '', category: data.category ?? 'General' },
  })
  revalidatePath(`/competitors/${competitorId}`)
  return feature
}

export async function updateCompetitorFeature(id: string, orgId: string, data: Partial<{
  name: string; description: string; category: string; prosText: string;
  consText: string; marketSentimentText: string; roadmapImplicationText: string;
}>) {
  const feature = await prisma.competitorFeature.findFirst({
    where: { id, competitor: { organizationId: orgId } },
  })
  if (!feature) throw new Error('Feature not found')
  const updated = await prisma.competitorFeature.update({ where: { id }, data })
  revalidatePath('/competitors')
  return updated
}

export async function deleteCompetitorFeature(id: string, orgId: string) {
  const feature = await prisma.competitorFeature.findFirst({
    where: { id, competitor: { organizationId: orgId } },
  })
  if (!feature) throw new Error('Feature not found')
  await prisma.competitorFeature.delete({ where: { id } })
  revalidatePath('/competitors')
}

export async function getKeyUpdates(orgId: string, productId?: string) {
  return prisma.competitorKeyUpdate.findMany({
    where: {
      competitor: {
        organizationId: orgId,
        ...(productId ? { productId } : {}),
      },
    },
    include: { competitor: true },
    orderBy: { detectedAt: 'desc' },
  })
}
