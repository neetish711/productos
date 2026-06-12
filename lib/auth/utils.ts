import { getServerSession } from 'next-auth'
import { authConfig } from './config'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { hasPermission, isAdmin, type PermissionKey } from '@/lib/permissions'

export async function getSession() {
  return getServerSession(authConfig)
}

export async function requireAuth() {
  const session = await getServerSession(authConfig)
  if (!session?.user) redirect('/login')
  return session
}

export async function requireOrgSession() {
  const session = await getServerSession(authConfig)
  if (!session?.user?.organizationId) redirect('/login')
  return session as typeof session & { user: { organizationId: string } }
}

export async function getOrgId(): Promise<string> {
  const session = await getServerSession(authConfig)
  if (!session?.user?.organizationId) redirect('/login')
  return session.user.organizationId
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (!isAdmin(session.user.role)) redirect('/access-denied')
  return session
}

export async function requirePermission(permission: PermissionKey) {
  const session = await requireAuth()
  if (!hasPermission(session.user.role, (session.user as any).permissions || [], permission)) {
    redirect('/access-denied')
  }
  return session
}

// API route helpers that return NextResponse instead of redirecting
export async function apiRequireAuth() {
  const session = await getServerSession(authConfig)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  return { error: null, session }
}

export async function apiRequirePermission(permission: PermissionKey) {
  const session = await getServerSession(authConfig)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  if (!hasPermission(session.user.role, (session.user as any).permissions || [], permission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}
