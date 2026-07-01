import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { decrypt, encrypt, maskApiKey } from '@/lib/encryption'
import { createAIClient } from '@/lib/ai/provider'
import { canAccessAdminPanel } from '@/lib/permissions'

// AUDIT S2-5: LLM config is admin-only (holds org-wide encrypted keys).
async function requireLlmAdminOrgId() {
  const session = await getServerSession(authConfig)
  if (!session?.user || !canAccessAdminPanel(session.user.role)) return null
  return session.user.organizationId
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await requireLlmAdminOrgId()
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    const orgId = await requireLlmAdminOrgId()
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const existing = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.lLMConfig.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await requireLlmAdminOrgId()
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const existing = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    if (body.label !== undefined) updateData.label = body.label
    if (body.defaultModel !== undefined) updateData.defaultModel = body.defaultModel
    if (body.provider !== undefined) updateData.provider = body.provider
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
      if (body.isActive) {
        await prisma.lLMConfig.updateMany({ where: { organizationId: orgId }, data: { isActive: false } })
      }
    }

    // Re-encrypt if a new API key is provided
    if (body.apiKey && body.apiKey.trim() !== '') {
      const { ciphertext, iv } = encrypt(body.apiKey)
      updateData.apiKeyEncrypted = ciphertext
      updateData.iv = iv
    }

    const updated = await prisma.lLMConfig.update({ where: { id: params.id }, data: updateData })
    return NextResponse.json({ ...updated, apiKeyEncrypted: maskApiKey('hidden'), iv: undefined })
  } catch (e: unknown) {
    console.error('PATCH /api/llm-configs/[id] error:', e)
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Test connection with stored key
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await requireLlmAdminOrgId()
    if (!orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const config = await prisma.lLMConfig.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
    const client = createAIClient(config.provider.toLowerCase() as any, apiKey, config.defaultModel)
    const result = await client.testConnection()
    return NextResponse.json(result)
  } catch (e: any) { return NextResponse.json({ ok: false, message: e.message }, { status: 500 }) }
}
