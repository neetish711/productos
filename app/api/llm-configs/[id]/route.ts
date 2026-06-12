import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { decrypt, encrypt, maskApiKey } from '@/lib/encryption'
import { createAIClient } from '@/lib/ai/provider'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()

    if (body.isActive) {
      await prisma.lLMConfig.updateMany({ where: { organizationId: orgId }, data: { isActive: false } })
    }

    let updateData: any = { label: body.label, defaultModel: body.defaultModel, isActive: body.isActive }
    if (body.apiKey && body.apiKey !== 'UNCHANGED') {
      const { ciphertext, iv } = encrypt(body.apiKey)
      updateData = { ...updateData, apiKeyEncrypted: ciphertext, iv }
    }

    const updated = await prisma.lLMConfig.update({ where: { id: params.id }, data: updateData })
    return NextResponse.json({ ...updated, apiKeyEncrypted: maskApiKey('hidden'), iv: undefined })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.lLMConfig.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

// Test connection with stored key
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const config = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
    const client = createAIClient(config.provider.toLowerCase() as any, apiKey, config.defaultModel)
    const result = await client.testConnection()
    return NextResponse.json(result)
  } catch (e: any) { return NextResponse.json({ ok: false, message: e.message }, { status: 500 }) }
}
