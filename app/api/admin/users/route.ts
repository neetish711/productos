import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !canAccessAdminPanel(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        permissionsJson: true,
        createdAt: true,
        updatedAt: true,
        productAccess: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
