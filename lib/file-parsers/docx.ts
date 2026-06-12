import mammoth from 'mammoth'
import type { ParsedFile } from './index'

export async function parseDOCX(buffer: Buffer): Promise<ParsedFile> {
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: result.value,
  }
}
