import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

export async function PUT(req: Request) {
  const session = await getServerSession(authConfig as any) as any
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const org = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { name: name.trim() },
  })

  return NextResponse.json(org)
}
