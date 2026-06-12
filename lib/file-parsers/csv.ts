import Papa from 'papaparse'
import type { ParsedFile } from './index'

export async function parseCSV(buffer: Buffer): Promise<ParsedFile> {
  const text = buffer.toString('utf-8')
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  const rows = result.data as unknown[]
  const headers = result.meta.fields || []

  const plainText = [
    headers.join(' | '),
    ...rows.map((row: any) => headers.map(h => row[h] ?? '').join(' | ')),
  ].join('\n')

  return {
    text: plainText,
    json: rows,
    meta: { rowCount: rows.length },
  }
}
