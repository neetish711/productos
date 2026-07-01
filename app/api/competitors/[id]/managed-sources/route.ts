import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { assertPublicUrl, SsrfBlockedError } from '@/lib/crawler/url-guard'

const createSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  sourceType: z.string().default('WEBSITE'),
  label: z.string().optional(),
  priority: z.string().default('NORMAL'),
  crawlFrequency: z.string().default('WEEKLY'),
  crawlDepth: z.number().int().min(1).max(10).default(2),
  includePaths: z.string().optional(),
  excludePaths: z.string().optional(),
  notes: z.string().optional(),
})

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch { return '' }
}

// GET /api/competitors/[id]/managed-sources
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const sources = await prisma.competitorSource.findMany({
      where: { competitorId: params.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(sources)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

// POST /api/competitors/[id]/managed-sources
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const competitor = await prisma.competitor.findFirst({
      where: { id: params.id, organizationId: orgId },
    })
    if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = createSchema.parse(await req.json())

    // AUDIT S2-4: reject SSRF-unsafe URLs at creation time (early feedback).
    try {
      await assertPublicUrl(body.url)
    } catch (e) {
      if (e instanceof SsrfBlockedError) return NextResponse.json({ error: e.message }, { status: 400 })
      throw e
    }

    // Deduplicate on normalized URL
    const normalizedUrl = body.url.replace(/\/$/, '').toLowerCase()
    const existing = await prisma.competitorSource.findFirst({
      where: { competitorId: params.id, url: { equals: normalizedUrl } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Source with this URL already exists' }, { status: 409 })
    }

    const source = await prisma.competitorSource.create({
      data: {
        competitorId: params.id,
        url: normalizedUrl,
        domain: extractDomain(body.url),
        sourceType: body.sourceType,
        label: body.label,
        priority: body.priority,
        crawlFrequency: body.crawlFrequency,
        crawlDepth: body.crawlDepth,
        includePaths: body.includePaths,
        excludePaths: body.excludePaths,
        notes: body.notes,
      },
    })
    return NextResponse.json(source, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error creating source' }, { status: 500 })
  }
}
