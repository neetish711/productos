import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import path from 'path'
import fs from 'fs/promises'
import { parsePDF } from '@/lib/file-parsers/pdf'
import { parseXLSX } from '@/lib/file-parsers/xlsx'
import { extractFeaturesFromText, saveFeaturesToDB } from '@/lib/ingest/features'
import { extractCompetitorsFromXLSX, saveCompetitorsToDB } from '@/lib/ingest/competitors'
import { extractComparisonsFromXLSX, saveComparisonsToDB } from '@/lib/ingest/comparisons'
import { upsertSystemPrompts } from '@/lib/ingest/prompts'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'

async function loadBuffer(stageKey: string, ext: string): Promise<Buffer> {
  const stagePath = path.join(UPLOAD_DIR, `${stageKey}.${ext}`)
  return fs.readFile(stagePath)
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId()

    const contentType = req.headers.get('content-type') ?? ''
    let stageKey: string
    let ext: string
    let filename: string
    let purpose: string

    if (contentType.includes('multipart/form-data')) {
      // Direct upload (legacy path)
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      purpose = (formData.get('purpose') as string) ?? ''
      if (!file || !purpose) return NextResponse.json({ error: 'file and purpose required' }, { status: 400 })
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      filename = file.name
      ext = path.extname(file.name).replace('.', '').toLowerCase()
      // Parse directly without staging
      return await runParsing(orgId, buffer, ext, filename, purpose)
    } else {
      // stageKey path
      const body = await req.json()
      stageKey = body.stageKey
      ext = body.ext
      filename = body.filename ?? ''
      purpose = body.purpose
      if (!stageKey || !ext || !purpose) {
        return NextResponse.json({ error: 'stageKey, ext, and purpose required' }, { status: 400 })
      }
      const buffer = await loadBuffer(stageKey, ext)
      const result = await runParsing(orgId, buffer, ext, filename, purpose)
      // Clean up staged file
      try { await fs.unlink(path.join(UPLOAD_DIR, `${stageKey}.${ext}`)) } catch {}
      return result
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ingest]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function runParsing(
  orgId: string,
  buffer: Buffer,
  ext: string,
  filename: string,
  purpose: string
): Promise<NextResponse> {
  let result: Record<string, unknown> = {}

  if (purpose === 'features') {
    const parsed = ext === 'pdf' ? await parsePDF(buffer) : await parseXLSX(buffer)
    const features = extractFeaturesFromText(parsed.text)
    if (features.length === 0) {
      return NextResponse.json({
        error: 'Could not extract features. Ensure the file has numbered or bulleted feature lists.',
      }, { status: 422 })
    }
    const saved = await saveFeaturesToDB(orgId, features)
    result = { extracted: features.length, ...saved }
  }

  if (purpose === 'competitors') {
    const competitors = extractCompetitorsFromXLSX(buffer)
    if (competitors.length === 0) {
      return NextResponse.json({
        error: 'Could not extract competitor data. Check the file structure.',
      }, { status: 422 })
    }
    const saved = await saveCompetitorsToDB(orgId, competitors)
    result = { extracted: competitors.length, ...saved }
  }

  if (purpose === 'comparisons') {
    const comparisons = extractComparisonsFromXLSX(buffer)
    if (comparisons.length === 0) {
      return NextResponse.json({
        error: 'Could not extract comparisons. Ensure feature names are in the first column and competitor names are column headers.',
      }, { status: 422 })
    }
    const saved = await saveComparisonsToDB(orgId, comparisons)
    result = { extracted: comparisons.length, ...saved }
  }

  const promptResult = await upsertSystemPrompts(orgId)

  return NextResponse.json({ success: true, purpose, filename, ...result, promptsUpdated: promptResult.upserted })
}
