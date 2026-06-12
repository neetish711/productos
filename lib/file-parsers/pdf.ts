import type { ParsedFile } from './index'

export async function parsePDF(buffer: Buffer): Promise<ParsedFile> {
  // Dynamic import to avoid SSR issues
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)

  return {
    text: data.text,
    meta: {
      pages: data.numpages,
    },
  }
}
