import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateOrgSlug } from '@/lib/utils'
import { ROLE_DEFAULTS } from '@/lib/permissions'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  organizationName: z.string().min(1).optional(),
  orgName: z.string().min(1).optional(),
  password: z.string().min(8),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.parse(body)
    const orgName = parsed.organizationName || parsed.orgName || 'My Organization'

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12)
    const slug = generateOrgSlug(orgName)

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        users: {
          create: {
            name: parsed.name,
            email: parsed.email,
            passwordHash,
            role: 'SUPER_ADMIN',
            status: 'APPROVED',
            permissionsJson: JSON.stringify(ROLE_DEFAULTS.SUPER_ADMIN),
          },
        },
      },
      include: { users: { select: { id: true } } },
    })

    // Create a default product for the org
    const product = await prisma.product.create({
      data: {
        name: 'Default Product',
        description: 'Your first product workspace',
        organizationId: org.id,
        createdById: org.users[0]?.id,
      },
    })

    // Grant the creator access to the default product
    if (org.users[0]) {
      await prisma.userProductAccess.create({
        data: { userId: org.users[0].id, productId: product.id },
      })
    }

    return NextResponse.json({ success: true, orgId: org.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
