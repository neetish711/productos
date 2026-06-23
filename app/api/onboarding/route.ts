import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/encryption'
import { getServerSession } from 'next-auth'

export async function POST(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.organizationId
  const userId = session.user.id
  const body = await req.json()
  const { step } = body

  try {
    if (step === 0 && typeof body.orgName === 'string' && body.orgName.trim().length > 0) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { name: body.orgName.trim(), onboardingStep: 1 },
      })
    }

    if (step === 1 && body.productName) {
      // Idempotency: check if product already exists
      const existingProduct = await prisma.product.findFirst({
        where: { organizationId: orgId, name: body.productName.trim() },
      })
      if (!existingProduct) {
        await prisma.product.create({
          data: {
            organizationId: orgId,
            name: body.productName.trim(),
            description: body.productDesc ?? '',
          },
        })
      }
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingStep: 2 },
      })
    }

    if (step === 2 && body.competitors?.length) {
      const validCompetitors = (body.competitors as { name: string; website: string }[])
        .filter(c => c.name?.trim())
      if (validCompetitors.length > 0) {
        // Idempotency: check which competitors already exist
        const existingCompetitors = await prisma.competitor.findMany({
          where: { organizationId: orgId, name: { in: validCompetitors.map(c => c.name.trim()) } },
          select: { name: true },
        })
        const existingNames = new Set(existingCompetitors.map(c => c.name))
        const newCompetitors = validCompetitors.filter(c => !existingNames.has(c.name.trim()))
        if (newCompetitors.length > 0) {
          await prisma.competitor.createMany({
            data: newCompetitors.map(c => ({
              organizationId: orgId,
              name: c.name.trim(),
              website: c.website?.trim() || '',
            })),
          })
        }
      }
      await prisma.organization.update({ where: { id: orgId }, data: { onboardingStep: 3 } })
    } else if (step === 2) {
      await prisma.organization.update({ where: { id: orgId }, data: { onboardingStep: 3 } })
    }

    if (step === 3) {
      if (body.aiKey?.trim()) {
        const { encrypted, iv } = encrypt(body.aiKey.trim()) as any
        await prisma.lLMConfig.create({
          data: {
            organizationId: orgId,
            provider: body.aiProvider || 'ANTHROPIC',
            label: `${body.aiProvider || 'ANTHROPIC'} (from onboarding)`,
            apiKeyEncrypted: encrypted,
            iv,
            defaultModel: body.aiModel || 'claude-sonnet-4-6',
            isActive: true,
          },
        })
      }
      await prisma.organization.update({ where: { id: orgId }, data: { onboardingStep: 4 } })
    }

    if (step === 4) {
      // Mark onboarding complete
      await prisma.organization.update({
        where: { id: orgId },
        data: { onboardingCompleted: true, onboardingStep: 5 },
      })
      // Removed unnecessary empty update on user
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Onboarding error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
