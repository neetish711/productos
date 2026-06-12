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
    if (step === 0 && body.orgName) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { name: body.orgName, onboardingStep: 1 },
      })
    }

    if (step === 1 && body.productName) {
      await Promise.all([
        prisma.product.create({
          data: {
            organizationId: orgId,
            name: body.productName,
            description: body.productDesc ?? '',
          },
        }),
        prisma.organization.update({
          where: { id: orgId },
          data: { onboardingStep: 2 },
        }),
      ])
    }

    if (step === 2 && body.competitors?.length) {
      const validCompetitors = (body.competitors as { name: string; website: string }[])
        .filter(c => c.name?.trim())
      if (validCompetitors.length > 0) {
        await prisma.competitor.createMany({
          data: validCompetitors.map(c => ({
            organizationId: orgId,
            name: c.name.trim(),
            website: c.website?.trim() || '',
          })),
        })
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
      await prisma.user.update({
        where: { id: userId },
        data: {},
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Onboarding error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
