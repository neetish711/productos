import * as XLSX from 'xlsx'
import type { ParsedFile } from './index'

export async function parseXLSX(buffer: Buffer): Promise<ParsedFile> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets = workbook.SheetNames

  const allRows: unknown[] = []
  const textParts: string[] = []

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    allRows.push(...rows)

    const csv = XLSX.utils.sheet_to_csv(sheet)
    textParts.push(`## Sheet: ${sheetName}\n${csv}`)
  }

  return {
    text: textParts.join('\n\n'),
    json: allRows,
    meta: {
      sheets,
      rowCount: allRows.length,
    },
  }
}
