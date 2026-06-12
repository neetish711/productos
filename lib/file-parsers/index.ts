export { parseCSV } from './csv'
export { parseXLSX } from './xlsx'
export { parsePDF } from './pdf'
export { parseDOCX } from './docx'

export type ParsedFile = {
  text: string
  json?: unknown[]
  meta?: {
    pages?: number
    sheets?: string[]
    rowCount?: number
  }
}
