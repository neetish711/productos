import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { canAccessAdminPanel } from '@/lib/permissions'

const COOKIE_NAME = 'selectedProductId'

/**
 * Get the currently selected product ID from cookies.
 * Falls back to the first product the user has access to.
 */
export async function getSelectedProductId(
  userId: string,
  orgId: string,
  userRole: string,
): Promise<string | null> {
  let cookieProductId: string | undefined
  try {
    const cookieStore = cookies()
    cookieProductId = cookieStore.get(COOKIE_NAME)?.value
  } catch {
    // cookies() not available in some contexts
  }

  if (cookieProductId) {
    // Verify user has access to this product
    if (canAccessAdminPanel(userRole)) {
      const exists = await prisma.product.findFirst({
        where: { id: cookieProductId, organizationId: orgId, status: 'ACTIVE' },
        select: { id: true },
      })
      if (exists) return cookieProductId
    } else {
      const access = await prisma.userProductAccess.findFirst({
        where: { userId, productId: cookieProductId, product: { status: 'ACTIVE' } },
        select: { productId: true },
      })
      if (access) return cookieProductId
    }
  }

  // Fallback: first accessible product
  if (canAccessAdminPanel(userRole)) {
    const first = await prisma.product.findFirst({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    return first?.id ?? null
  }

  const access = await prisma.userProductAccess.findFirst({
    where: { userId, product: { status: 'ACTIVE' } },
    select: { productId: true },
    orderBy: { product: { name: 'asc' } },
  })
  return access?.productId ?? null
}

/**
 * Get accessible product IDs for a user (for filtering queries).
 * Admins get all org products; others get only assigned products.
 */
export async function getAccessibleProductIds(
  userId: string,
  orgId: string,
  userRole: string,
): Promise<string[]> {
  if (canAccessAdminPanel(userRole)) {
    const products = await prisma.product.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { id: true },
    })
    return products.map((p) => p.id)
  }

  const access = await prisma.userProductAccess.findMany({
    where: { userId, product: { status: 'ACTIVE', organizationId: orgId } },
    select: { productId: true },
  })
  return access.map((a) => a.productId)
}

/**
 * Get selected product ID from cookie in API route context.
 * Use request headers to read cookie when next/headers cookies() isn't available.
 */
export function getProductIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/selectedProductId=([^;]+)/)
  return match ? match[1] : null
}
