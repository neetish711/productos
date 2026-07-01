import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { encrypt, maskApiKey } from '@/lib/encryption'
import { canAccessAdminPanel } from '@/lib/permissions'
import { z } from 'zod'

// AUDIT S2-5: LLM configuration holds org-wide encrypted API keys. Restrict all
// access to admin-panel roles (SUPER_ADMIN / SENIOR_PM / PM) — previously any
// approved org user (incl. CSM/Sales/Engineering) could read or overwrite it.
async function requireLlmAdmin() {
  const session = await getServerSession(authConfig)
  if (!session?.user || !canAccessAdminPanel(session.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), orgId: null as string | null }
  }
  return { error: null, orgId: session.user.organizationId }
}

export async function GET() {
  const { error, orgId } = await requireLlmAdmin()
  if (error) return error
  const configs = await prisma.lLMConfig.findMany({ where: { organizationId: orgId! } })
  return NextResponse.json(configs.map((c) => ({ ...c, apiKeyEncrypted: maskApiKey('hidden'), iv: undefined })))
}

const createSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'CUSTOM']),
  // label is optional on the form — fall back to the provider name
  label: z.string().default('').transform((v, ctx) => {
    const trimmed = v.trim()
    // We'll fill the fallback after we know the provider; use a marker for now
    return trimmed
  }),
  apiKey: z.string().min(1, 'API key is required'),
  defaultModel: z.string().min(1, 'Default model is required'),
  baseUrl: z.string().optional(),
  isActive: z.boolean().default(false),
})

export async function POST(req: Request) {
  let body: z.infer<typeof createSchema>

  try {
    const { error, orgId: gatedOrgId } = await requireLlmAdmin()
    if (error) return error
    const orgId = gatedOrgId!
    const raw = await req.json().catch(() => null)
    if (!raw) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

    const parsed = createSchema.safeParse(raw)
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      return NextResponse.json({ error: messages }, { status: 400 })
    }
    body = parsed.data

    // Fall back label to provider name if not provided
    if (!body.label) body = { ...body, label: body.provider }

    let ciphertext: string
    let iv: string
    try {
      const encrypted = encrypt(body.apiKey)
      ciphertext = encrypted.ciphertext
      iv = encrypted.iv
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : 'Encryption failed'
      console.error('Encryption error:', encErr)
      return NextResponse.json({ error: `Encryption configuration error: ${msg}` }, { status: 500 })
    }

    // If setting as active, deactivate others first
    if (body.isActive) {
      await prisma.lLMConfig.updateMany({ where: { organizationId: orgId }, data: { isActive: false } })
    }

    const config = await prisma.lLMConfig.create({
      data: {
        organizationId: orgId,
        provider: body.provider,
        label: body.label,
        apiKeyEncrypted: ciphertext,
        iv,
        defaultModel: body.defaultModel,
        baseUrl: body.baseUrl,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({ ...config, apiKeyEncrypted: maskApiKey('hidden'), iv: undefined }, { status: 201 })
  } catch (e) {
    console.error('POST /api/llm-configs error:', e)
    const msg = e instanceof Error ? e.message : 'Unexpected server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
