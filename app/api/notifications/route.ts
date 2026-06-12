import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json(notifications)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authConfig)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.organizationId
  const body = await req.json()

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { organizationId: orgId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, organizationId: orgId },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
