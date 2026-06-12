import { prisma } from '@/lib/db'
import { getAIClient } from '@/lib/ai/provider'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authConfig as any) as any
    if (!session?.user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const orgId = session.user.organizationId

    const { specId, messages } = await req.json()

    // Load spec context
    let specContext = ''
    if (specId) {
      const spec = await prisma.spec.findFirst({
        where: { id: specId, roadmapItem: { product: { organizationId: orgId } } },
      })
      if (spec) specContext = spec.contentMd
    }

    const aiClient = await getAIClient(orgId)

    const systemPrompt = specContext
      ? `You are a senior product manager helping refine a product spec. Here is the current spec:\n\n${specContext}\n\nHelp the user improve or clarify specific parts. Be concise and specific.`
      : 'You are a helpful product management assistant.'

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = ''
          await aiClient.complete({
            model: aiClient.defaultModel,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            maxTokens: 2000,
            stream: true,
            onToken: (token) => {
              fullContent += token
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
            },
          })
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, content: fullContent })}\n\n`))
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch { return new Response('Error', { status: 500 }) }
}
