import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const requestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // AUDIT S2-8: accepted but treated as a non-binding hint. The granted role is
  // decided by an admin at approval time, never by this public payload.
  requestedRole: z.string().default('VIEWER'),
  organizationId: z.string().optional(),
  reason: z.string().default(''),
})

// POST - Create access request (public)
export async function POST(req: Request) {
  try {
    const body = requestSchema.parse(await req.json())

    // Check if email already exists as a user
    const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }

    // Check for existing pending request
    const existingRequest = await prisma.accessRequest.findFirst({
      where: { email: body.email, status: 'PENDING' },
    })
    if (existingRequest) {
      return NextResponse.json({ error: 'You already have a pending access request.' }, { status: 409 })
    }

    // If no org specified, use the first org (single-tenant fallback)
    let orgId = body.organizationId
    if (!orgId) {
      const firstOrg = await prisma.organization.findFirst()
      orgId = firstOrg?.id
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    // AUDIT S2-8: persist the request WITH the password hash but do NOT create a
    // User. No login exists until an admin approves and assigns a role. This
    // prevents account pre-seeding / squatting and self-selected privilege.
    const request = await prisma.accessRequest.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        requestedRole: body.requestedRole, // stored for admin reference only
        organizationId: orgId,
        reason: body.reason,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ success: true, id: request.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || 'Invalid input' }, { status: 400 })
    }
    console.error('Access request error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - List access requests (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requests = await prisma.accessRequest.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(requests)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
