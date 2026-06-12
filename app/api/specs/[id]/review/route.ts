import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const reviewSchema = z.object({
  action: z.enum(['SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES']),
  feedback: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authConfig) as any
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = reviewSchema.parse(await req.json())
    const orgId = session.user.organizationId
    const permissions = session.user.permissions || []

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    switch (body.action) {
      case 'SUBMIT': {
        if (!hasPermission(session.user.role, permissions, 'submit_for_review')) {
          return NextResponse.json({ error: 'No permission to submit for review' }, { status: 403 })
        }
        await prisma.spec.update({
          where: { id: params.id },
          data: {
            lifecycleState: 'SUBMITTED',
            submittedByUserId: session.user.id,
            submittedAt: new Date(),
          },
        })
        break
      }
      case 'APPROVE': {
        if (!hasPermission(session.user.role, permissions, 'approve_story')) {
          return NextResponse.json({ error: 'No permission to approve' }, { status: 403 })
        }
        await prisma.spec.update({
          where: { id: params.id },
          data: {
            lifecycleState: 'APPROVED',
            approvedByUserId: session.user.id,
            approvedAt: new Date(),
            reviewFeedback: body.feedback,
          },
        })
        break
      }
      case 'REJECT': {
        if (!hasPermission(session.user.role, permissions, 'reject_story')) {
          return NextResponse.json({ error: 'No permission to reject' }, { status: 403 })
        }
        await prisma.spec.update({
          where: { id: params.id },
          data: {
            lifecycleState: 'REJECTED',
            reviewFeedback: body.feedback,
          },
        })
        break
      }
      case 'REQUEST_CHANGES': {
        if (!hasPermission(session.user.role, permissions, 'reject_story')) {
          return NextResponse.json({ error: 'No permission to request changes' }, { status: 403 })
        }
        await prisma.spec.update({
          where: { id: params.id },
          data: {
            lifecycleState: 'CHANGES_REQUESTED',
            reviewFeedback: body.feedback,
          },
        })
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
