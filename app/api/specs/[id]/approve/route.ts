import { NextResponse } from 'next/server'
import { getOrgId, getSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { hasPermission, isAdmin } from '@/lib/permissions'

const schema = z.object({
  action: z.enum(['SUBMIT_REVIEW', 'APPROVE', 'REQUEST_REVISION', 'REJECT', 'ARCHIVE', 'UNARCHIVE']),
  versionId: z.string().optional(),
  reason: z.string().optional(),
  feedback: z.string().optional(),
  reviewDueDate: z.string().optional(),
  handoffStatus: z.string().optional(),
})

const STATE_TRANSITIONS: Record<string, Record<string, string>> = {
  DRAFT: { SUBMIT_REVIEW: 'SUBMITTED', ARCHIVE: 'ARCHIVED' },
  SUBMITTED: { APPROVE: 'APPROVED', REQUEST_REVISION: 'CHANGES_REQUESTED', REJECT: 'REJECTED', ARCHIVE: 'ARCHIVED' },
  IN_REVIEW: { APPROVE: 'APPROVED', REQUEST_REVISION: 'CHANGES_REQUESTED', REJECT: 'REJECTED', ARCHIVE: 'ARCHIVED' },
  CHANGES_REQUESTED: { SUBMIT_REVIEW: 'SUBMITTED', ARCHIVE: 'ARCHIVED' },
  NEEDS_REVISION: { SUBMIT_REVIEW: 'SUBMITTED', ARCHIVE: 'ARCHIVED' },
  REJECTED: { SUBMIT_REVIEW: 'SUBMITTED', ARCHIVE: 'ARCHIVED' },
  APPROVED: { ARCHIVE: 'ARCHIVED' },
  ARCHIVED: { UNARCHIVE: 'DRAFT' },
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const session = await getSession() as any
    const body = schema.parse(await req.json())
    const permissions = session.user.permissions || []

    // Permission checks
    const reviewActions = ['APPROVE', 'REQUEST_REVISION', 'REJECT', 'ARCHIVE', 'UNARCHIVE']
    if (reviewActions.includes(body.action)) {
      const canReview = isAdmin(session.user.role) ||
        hasPermission(session.user.role, permissions, 'approve_story') ||
        hasPermission(session.user.role, permissions, 'reject_story')
      if (!canReview) {
        return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 })
      }
    }

    if (body.action === 'SUBMIT_REVIEW') {
      if (!isAdmin(session.user.role) && !hasPermission(session.user.role, permissions, 'submit_for_review')) {
        return NextResponse.json({ error: 'No permission to submit for review.' }, { status: 403 })
      }
    }

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      select: { id: true, lifecycleState: true, roadmapItemId: true },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const currentState = spec.lifecycleState || 'DRAFT'
    const allowed = STATE_TRANSITIONS[currentState]
    if (!allowed || !allowed[body.action]) {
      return NextResponse.json({ error: `Cannot ${body.action} from state ${currentState}` }, { status: 400 })
    }
    const newState = allowed[body.action]

    const updateData: any = { lifecycleState: newState }
    if (body.action === 'APPROVE') {
      updateData.approvedByUserId = session.user.id
      updateData.approvedAt = new Date()
      if (body.versionId) updateData.approvedVersionId = body.versionId
    }
    if (body.action === 'SUBMIT_REVIEW') {
      updateData.submittedByUserId = session.user.id
      updateData.submittedAt = new Date()
    }
    if (body.action === 'REJECT' || body.action === 'REQUEST_REVISION') {
      updateData.reviewFeedback = body.feedback || body.reason || null
    }
    if (body.reviewDueDate) updateData.reviewDueDate = new Date(body.reviewDueDate)
    if (body.handoffStatus) updateData.handoffStatus = body.handoffStatus

    const updated = await prisma.spec.update({ where: { id: params.id }, data: updateData })

    if (spec.roadmapItemId) {
      const specStatusMap: Record<string, string> = {
        DRAFT: 'DRAFT', SUBMITTED: 'UNDER_REVIEW', IN_REVIEW: 'UNDER_REVIEW',
        APPROVED: 'APPROVED', CHANGES_REQUESTED: 'NEEDS_REVISION',
        NEEDS_REVISION: 'NEEDS_REVISION', REJECTED: 'REJECTED', ARCHIVED: 'ARCHIVED',
      }
      await prisma.roadmapItem.update({
        where: { id: spec.roadmapItemId },
        data: { specStatus: specStatusMap[newState] || 'DRAFT' },
      })
      await prisma.roadmapActivity.create({
        data: {
          roadmapItemId: spec.roadmapItemId,
          specId: params.id,
          eventType: 'state_changed',
          actorName: session.user.name,
          metadataJson: JSON.stringify({ from: currentState, to: newState, action: body.action, reason: body.reason }),
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    console.error(e)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
