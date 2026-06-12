import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateOrgSlug } from '@/lib/utils'
import { ROLE_DEFAULTS, DEPARTMENT_ROLE_MAP } from '@/lib/permissions'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  organizationName: z.string().min(1).optional(),
  orgName: z.string().min(1).optional(),
  password: z.string().min(8),
  department: z.string().optional(),
  requestedRole: z.string().optional(),
  reason: z.string().optional(),
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

    // Check if any organization exists — first user of an org gets PM role (approved)
    // Subsequent users get PENDING status
    const existingOrg = await prisma.organization.findFirst()

    if (existingOrg) {
      // Join existing org as PENDING user
      const department = parsed.department || 'OTHER'
      const role = DEPARTMENT_ROLE_MAP[department] || 'VIEWER'

      const user = await prisma.user.create({
        data: {
          name: parsed.name,
          email: parsed.email,
          passwordHash,
          role,
          status: 'PENDING',
          organizationId: existingOrg.id,
          permissionsJson: JSON.stringify(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.VIEWER),
        },
      })

      // Create access request for admin to review
      await prisma.accessRequest.create({
        data: {
          name: parsed.name,
          email: parsed.email,
          requestedRole: role,
          organizationId: existingOrg.id,
          reason: parsed.reason || `Department: ${department}`,
          status: 'PENDING',
        },
      })

      return NextResponse.json({
        success: true,
        pending: true,
        message: 'Your account has been created and is pending admin approval.',
      }, { status: 201 })
    }

    // First org ever — create org + first user as PM (approved), not SUPER_ADMIN
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
            role: 'PM',
            status: 'APPROVED',
            permissionsJson: JSON.stringify(ROLE_DEFAULTS.PM),
          },
        },
      },
      include: { users: { select: { id: true } } },
    })

    // Create a default product
    const product = await prisma.product.create({
      data: {
        name: 'Default Product',
        description: 'Your first product workspace',
        organizationId: org.id,
        createdById: org.users[0]?.id,
      },
    })

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
