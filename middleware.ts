import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/request-access', '/api/auth', '/api/access-requests', '/access-denied']
const ADMIN_PATHS = ['/admin']

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // Not authenticated → redirect to login
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check user status - only APPROVED users can access the app
  if ((token as any).status && (token as any).status !== 'APPROVED') {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('error', 'pending')
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes — only SUPER_ADMIN and ADMIN
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const role = (token as any).role
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'SENIOR_PM', 'PM']
    if (!adminRoles.includes(role)) {
      return NextResponse.redirect(new URL('/access-denied', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
