import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { parseCSV, parseXLSX, parsePDF, parseDOCX } from '@/lib/file-parsers'
import { getServerSession } from 'next-auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const purpose = (formData.get('purpose') as string) || 'GENERAL'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const orgId = session.user.organizationId

  let parsed
  const ext = file.name.split('.').pop()?.toLowerCase()

  try {
    if (file.type === 'text/csv' || ext === 'csv') {
      parsed = await parseCSV(buffer)
    } else if (ext === 'xlsx' || file.type.includes('spreadsheet') || file.type.includes('excel')) {
      parsed = await parseXLSX(buffer)
    } else if (file.type === 'application/pdf' || ext === 'pdf') {
      parsed = await parsePDF(buffer)
    } else if (ext === 'docx' || file.type.includes('wordprocessingml')) {
      parsed = await parseDOCX(buffer)
    } else {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }
  } catch (e) {
    console.error('Parse error:', e)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }

  const record = await prisma.uploadedFile.create({
    data: {
      organizationId: orgId,
      filename: file.name,
      fileType: ext?.toUpperCase() || 'UNKNOWN',
      parsedText: parsed.text.slice(0, 100000), // cap at 100k chars
      parsedJson: parsed.json ? JSON.stringify(parsed.json) : null,
      uploadPurpose: purpose as any,
    } as any,
  })

  return NextResponse.json({
    id: record.id,
    filename: file.name,
    parsedText: parsed.text.slice(0, 2000), // preview
    rowCount: parsed.meta?.rowCount,
    pages: parsed.meta?.pages,
    sheets: parsed.meta?.sheets,
  })
}
