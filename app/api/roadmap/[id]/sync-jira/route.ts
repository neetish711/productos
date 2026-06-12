import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const productIds = (
      await prisma.product.findMany({ where: { organizationId: orgId }, select: { id: true } })
    ).map((p) => p.id)

    const item = await prisma.roadmapItem.findFirst({
      where: { id: params.id, productId: { in: productIds } },
    })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!item.jiraKey)
      return NextResponse.json({ error: 'This item has no Jira key' }, { status: 400 })

    // TODO: integrate with Jira REST API using org-level credentials.
    // When configured, fetch: status, summary, linked epics, child issues, sprint stage.
    // Update item with jiraStatus and jiraLastSyncAt, then return the updated item.
    return NextResponse.json(
      {
        synced: false,
        message:
          'Jira integration not configured. Add your Jira base URL and API token in workspace settings.',
      },
      { status: 501 }
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
