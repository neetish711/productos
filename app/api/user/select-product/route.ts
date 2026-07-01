import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { cookies } from 'next/headers'
import { getAccessibleProductIds } from '@/lib/product-context'

export async function POST(req: Request) {
  const session = await getServerSession(authConfig)
  const user = session?.user as { id?: string; organizationId?: string; role?: string } | undefined
  if (!user?.id || !user.organizationId || !user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { productId } = await req.json()
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  // AUDIT P0-4: verify the user actually has access to this product before
  // persisting it as their selection. Previously any productId was accepted and
  // the cookie drove data scoping.
  const accessible = await getAccessibleProductIds(user.id, user.organizationId, user.role)
  if (!accessible.includes(productId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // AUDIT P0-4: httpOnly + secure (in prod) so the scoping cookie can't be read
  // or forged by client-side JS. Note: cookies are still fully client-controlled
  // at the HTTP level, which is why resolveProductIdFromRequest re-verifies access.
  cookies().set('selectedProductId', productId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })

  return NextResponse.json({ success: true })
}
