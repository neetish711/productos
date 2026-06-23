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

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

    if (contentType.includes('multipart/form-data')) {
      // Direct upload (legacy path)
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      purpose = (formData.get('purpose') as string) ?? ''
      if (!file || !purpose) return NextResponse.json({ error: 'file and purpose required' }, { status: 400 })
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large. Maximum size is 10MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB.` }, { status: 413 })
      }
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
      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large. Maximum size is 10MB, got ${(buffer.length / 1024 / 1024).toFixed(1)}MB.` }, { status: 413 })
      }
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
    let parsed: { text: string }
    try {
      parsed = ext === 'pdf' ? await parsePDF(buffer) : await parseXLSX(buffer)
    } catch (parseErr) {
      const msg = ext === 'pdf'
        ? 'Failed to parse PDF. Ensure the file is a valid, non-encrypted PDF document.'
        : 'Failed to parse XLSX. Ensure the file is a valid Excel spreadsheet.'
      console.error(`[ingest] ${ext} parse error:`, parseErr instanceof Error ? parseErr.message : parseErr)
      return NextResponse.json({ error: msg }, { status: 422 })
    }
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
    let competitors: ReturnType<typeof extractCompetitorsFromXLSX>
    try {
      competitors = extractCompetitorsFromXLSX(buffer)
    } catch (parseErr) {
      console.error('[ingest] XLSX competitor parse error:', parseErr instanceof Error ? parseErr.message : parseErr)
      return NextResponse.json({ error: 'Failed to parse competitor data from XLSX. Ensure the file is a valid Excel spreadsheet.' }, { status: 422 })
    }
    if (competitors.length === 0) {
      return NextResponse.json({
        error: 'Could not extract competitor data. Check the file structure.',
      }, { status: 422 })
    }
    const saved = await saveCompetitorsToDB(orgId, competitors)
    result = { extracted: competitors.length, ...saved }
  }

  if (purpose === 'comparisons') {
    let comparisons: ReturnType<typeof extractComparisonsFromXLSX>
    try {
      comparisons = extractComparisonsFromXLSX(buffer)
    } catch (parseErr) {
      console.error('[ingest] XLSX comparison parse error:', parseErr instanceof Error ? parseErr.message : parseErr)
      return NextResponse.json({ error: 'Failed to parse comparison data from XLSX. Ensure feature names are in the first column and competitor names are column headers.' }, { status: 422 })
    }
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
