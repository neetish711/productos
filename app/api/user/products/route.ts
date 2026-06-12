import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'

// GET products the current user has access to
export async function GET() {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orgId = session.user.organizationId

    // Admin-level roles see all products in the org
    if (canAccessAdminPanel(session.user.role)) {
      const products = await prisma.product.findMany({
        where: { organizationId: orgId, status: 'ACTIVE' },
        include: {
          _count: { select: { roadmapItems: true, ourFeatures: true } },
        },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(products)
    }

    // Others see only assigned products
    const access = await prisma.userProductAccess.findMany({
      where: { userId: session.user.id },
      include: {
        product: {
          include: {
            _count: { select: { roadmapItems: true, ourFeatures: true } },
          },
        },
      },
    })

    const products = access
      .map((a) => a.product)
      .filter((p) => p.status === 'ACTIVE')

    return NextResponse.json(products)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
