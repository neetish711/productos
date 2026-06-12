import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const renameSchema = z.object({ from: z.string().min(1), to: z.string().min(1) })

// PATCH /api/roadmap/categories — bulk rename a category across all items in the org
export async function PATCH(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = renameSchema.parse(await req.json())

    const productIds = (
      await prisma.product.findMany({ where: { organizationId: orgId }, select: { id: true } })
    ).map((p) => p.id)

    const result = await prisma.roadmapItem.updateMany({
      where: { productId: { in: productIds }, category: body.from },
      data: { category: body.to },
    })

    return NextResponse.json({ updated: result.count })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to rename category' }, { status: 500 })
  }
}
