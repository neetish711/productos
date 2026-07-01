import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { resolveProductIdFromRequest } from '@/lib/product-context'
import { z } from 'zod'

export async function GET(req: Request) {
  try {
    const orgId = await getOrgId()
    const productId = await resolveProductIdFromRequest(req)
    const features = await prisma.ourFeature.findMany({
      where: {
        product: { organizationId: orgId },
        ...(productId ? { productId } : {}),
      },
      include: { product: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    const mapped = features.map(({ product, ...f }) => ({
      ...f,
      productName: product.name,
    }))
    return NextResponse.json(mapped)
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

const createSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('General'),
  status: z.enum(['AVAILABLE', 'PLANNED', 'DEPRECATED', 'IN_REVIEW']).default('AVAILABLE'),
})

export async function POST(req: Request) {
  try {
    const orgId = await getOrgId()
    const body = createSchema.parse(await req.json())
    const product = await prisma.product.findFirst({ where: { id: body.productId, organizationId: orgId } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    const feature = await prisma.ourFeature.create({ data: body })
    return NextResponse.json(feature, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
