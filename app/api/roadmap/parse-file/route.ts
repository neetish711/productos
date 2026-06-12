import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import * as XLSX from 'xlsx'

const FIELD_HINTS: Record<string, string[]> = {
  title: ['title', 'feature', 'name', 'item', 'feature name', 'feature title', 'task'],
  description: ['description', 'desc', 'details', 'summary', 'detail'],
  category: ['category', 'type', 'area', 'theme', 'pillar', 'domain'],
  status: ['status', 'state', 'progress'],
  targetQuarter: ['quarter', 'timeline', 'target release', 'eta'],
  jiraKey: ['jira', 'ticket', 'issue key', 'jira key', 'jira ticket'],
  priority: ['priority', 'prio', 'importance'],
  startDate: ['start date', 'start at', 'begin date', 'kickoff'],
  endDate: ['end date', 'due date', 'deadline', 'finish date', 'target date'],
  storyPoints: ['story points', 'sp', 'story_points', 'estimate', 'size'],
  qaStatus: ['qa status', 'qa_status', 'test status', 'qa'],
  riceReach: ['reach', 'users', 'audience'],
  riceImpact: ['impact', 'value'],
  riceConfidence: ['confidence', 'conf'],
  riceEffort: ['effort', 'complexity', 'work'],
}

function buildSuggestedMapping(headers: string[]): Record<string, string> {
  const used = new Set<string>()
  const result: Record<string, string> = {}
  for (const header of headers) {
    const lh = header.toLowerCase()
    for (const [field, hints] of Object.entries(FIELD_HINTS)) {
      if (!used.has(field) && hints.some(h => lh.includes(h))) {
        result[header] = field
        used.add(field)
        break
      }
    }
  }
  return result
}

function isEmptyColumn(name: string): boolean {
  return /^__EMPTY/.test(name) || name.trim() === ''
}

export async function POST(req: Request) {
  try {
    await getOrgId()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode')       // 'detect' = sheet list only
    const sheetParam = url.searchParams.get('sheet')
    const headerRowParam = url.searchParams.get('headerRow') // 0-indexed

    // -----------------------------------------------------------------------
    // CSV
    // -----------------------------------------------------------------------
    if (ext === 'csv') {
      const text = buffer.toString('utf-8')
      const allLines = text.split('\n').filter(l => l.trim())
      const parseRow = (line: string) => line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))

      // Build raw preview rows (first 10)
      const previewRows = allLines.slice(0, 10).map(parseRow)

      const headerRowIndex = headerRowParam ? parseInt(headerRowParam, 10) : 0
      const headers = previewRows[headerRowIndex] ?? []
      const rows: Record<string, string>[] = []
      for (let i = headerRowIndex + 1; i < Math.min(allLines.length, headerRowIndex + 501); i++) {
        const vals = parseRow(allLines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, j) => { row[h] = vals[j] ?? '' })
        if (Object.values(row).some(v => v)) rows.push(row)
      }

      return NextResponse.json({
        fileType: 'csv',
        headers,
        rows: rows.slice(0, 50),
        totalRows: rows.length,
        suggestedMapping: buildSuggestedMapping(headers),
        headerRowIndex,
        previewRows,
        sheetNames: [],
      })
    }

    // -----------------------------------------------------------------------
    // Excel
    // -----------------------------------------------------------------------
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const sheetNames = wb.SheetNames

      // Mode: detect sheets only (no row parsing)
      if (mode === 'detect') {
        const sheets = sheetNames.map(name => {
          const ws = wb.Sheets[name]
          const ref = ws['!ref']
          if (!ref) return { name, rowCount: 0, colCount: 0 }
          const range = XLSX.utils.decode_range(ref)
          return {
            name,
            rowCount: Math.max(0, range.e.r - range.s.r),
            colCount: range.e.c - range.s.c + 1,
          }
        })
        return NextResponse.json({ fileType: 'xlsx', mode: 'detect', sheets })
      }

      // Parse a specific sheet (or auto-select if only one)
      const sheetName = sheetParam && sheetNames.includes(sheetParam) ? sheetParam : sheetNames[0]
      const ws = wb.Sheets[sheetName]

      // Get raw rows as string[][]
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
      const previewRows = rawData.slice(0, 10).map(row =>
        (row as unknown[]).map(c => String(c ?? ''))
      )

      const headerRowIndex = headerRowParam ? parseInt(headerRowParam, 10) : 0
      const rawHeaderRow = (rawData[headerRowIndex] as unknown[]) ?? []

      // Filter out __EMPTY and blank columns; build index map
      const colMap: { name: string; srcIdx: number }[] = []
      rawHeaderRow.forEach((cell, j) => {
        const name = String(cell ?? '').trim()
        if (!isEmptyColumn(name)) colMap.push({ name, srcIdx: j })
      })

      const headers = colMap.map(c => c.name)
      const rows: Record<string, string>[] = []
      for (let i = headerRowIndex + 1; i < rawData.length && rows.length < 500; i++) {
        const rawRow = (rawData[i] as unknown[]) ?? []
        const row: Record<string, string> = {}
        colMap.forEach(({ name, srcIdx }) => { row[name] = String(rawRow[srcIdx] ?? '') })
        if (Object.values(row).some(v => v)) rows.push(row)
      }

      return NextResponse.json({
        fileType: 'xlsx',
        sheetName,
        sheetNames,
        headers,
        rows: rows.slice(0, 50),
        totalRows: rows.length,
        suggestedMapping: buildSuggestedMapping(headers),
        headerRowIndex,
        previewRows,
      })
    }

    // -----------------------------------------------------------------------
    // PDF
    // -----------------------------------------------------------------------
    if (ext === 'pdf') {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const parsed = await pdfParse(buffer)
        const lines = parsed.text
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 5)
        const headers = ['title', 'description']
        const rows = lines.slice(0, 200).map((line: string) => ({ title: line, description: '' }))
        return NextResponse.json({
          fileType: 'pdf',
          headers,
          rows: rows.slice(0, 50),
          totalRows: rows.length,
          suggestedMapping: { title: 'title' },
          headerRowIndex: 0,
          previewRows: [],
          sheetNames: [],
        })
      } catch {
        return NextResponse.json({ error: 'PDF parsing failed. Try CSV or Excel.' }, { status: 422 })
      }
    }

    return NextResponse.json({ error: 'Unsupported file type. Use PDF, Excel, or CSV.' }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'File parsing failed' }, { status: 500 })
  }
}
