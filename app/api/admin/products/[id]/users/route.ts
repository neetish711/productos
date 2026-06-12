import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { z } from 'zod'

// Add users to a product
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userIds } = z.object({ userIds: z.array(z.string()) }).parse(await req.json())

    await (prisma.userProductAccess.createMany as any)({
      data: userIds.map((uid) => ({ userId: uid, productId: params.id })),
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Remove a user from a product
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = z.object({ userId: z.string() }).parse(await req.json())

    await prisma.userProductAccess.deleteMany({
      where: { userId, productId: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
