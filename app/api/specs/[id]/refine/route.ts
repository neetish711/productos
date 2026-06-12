import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig as any) as any
    if (!session?.user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const orgId = session.user.organizationId
    const userId = session.user.id

    const spec = await prisma.spec.findFirst({ where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } } })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { instruction } = await req.json()
    if (!instruction) return NextResponse.json({ error: 'instruction required' }, { status: 400 })

    const aiClient = await getAIClient(orgId)
    const result = await aiClient.complete({
      model: aiClient.defaultModel,
      messages: [
        { role: 'system', content: 'You are a senior product manager. Improve the provided product spec according to the instruction. Return ONLY the improved full markdown spec, nothing else.' },
        { role: 'user', content: `Current spec:\n\n${spec.contentMd}\n\nInstruction: ${instruction}` },
      ],
      maxTokens: 4000,
    })

    const newVersion = spec.version + 1
    await prisma.$transaction([
      prisma.spec.update({ where: { id: params.id }, data: { contentMd: result.content, version: newVersion } }),
      prisma.specVersion.create({ data: { specId: params.id, version: newVersion, contentMd: result.content, changedByUserId: userId, changeSummary: `AI refined: ${instruction.slice(0, 80)}` } }),
      prisma.promptExecutionLog.create({ data: { organizationId: orgId, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens: result.totalTokens, estimatedCost: result.estimatedCost, durationMs: result.durationMs } }),
    ])

    return NextResponse.json({ content: result.content, version: newVersion })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: 500 })
  }
}
