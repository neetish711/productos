/**
 * Stage an uploaded file to disk and return a stageKey.
 * The client uploads here first (with XHR progress), then calls /api/ingest with the stageKey to parse.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'

export async function POST(req: NextRequest) {
  try {
    await getOrgId()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save to uploads dir with a unique key
    const stageKey = randomUUID()
    const ext = path.extname(file.name).toLowerCase()
    const stagePath = path.join(UPLOAD_DIR, `${stageKey}${ext}`)

    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    await fs.writeFile(stagePath, buffer)

    return NextResponse.json({
      stageKey,
      filename: file.name,
      size: buffer.length,
      ext: ext.replace('.', ''),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
