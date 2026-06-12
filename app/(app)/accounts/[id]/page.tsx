import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountDetailClient } from './_client'
import { formatDate, timeAgo } from '@/lib/utils'

const healthConfig: Record<string, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-blue-100 text-blue-800' },
  HEALTHY: { label: 'Healthy', className: 'bg-emerald-100 text-emerald-800' },
  AT_RISK: { label: 'At Risk', className: 'bg-amber-100 text-amber-800' },
  CRITICAL: { label: 'Critical', className: 'bg-red-100 text-red-800' },
  CHURNED: { label: 'Churned', className: 'bg-gray-100 text-gray-600' },
}

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const session = await requireOrgSession()
  const account = await prisma.account.findFirst({
    where: { id: params.id, organizationId: session.user.organizationId },
    include: { updates: { orderBy: { createdAt: 'desc' } } },
  })
  if (!account) notFound()

  const health = healthConfig[account.healthStatus] ?? healthConfig['NEW']
  const allFeatureRequests = account.updates.flatMap((u) => (u.featureRequestsJson as unknown as string[]) ?? [])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{account.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${health.className}`}>{health.label}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {account.csmName && <span>CSM: <strong className="text-foreground">{account.csmName}</strong></span>}
            {account.csmEmail && <span>{account.csmEmail}</span>}
            <span>Cadence: <strong className="text-foreground">{account.meetingCadence.toLowerCase()}</strong></span>
          </div>
        </div>
        <AccountDetailClient account={account} />
      </div>

      {/* Summary cards */}
      {(account.notesText || account.risksText || account.openAsksText) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {account.notesText && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{account.notesText}</p></CardContent></Card>}
          {account.risksText && <Card className="border-amber-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700">Risks</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{account.risksText}</p></CardContent></Card>}
          {account.openAsksText && <Card className="border-blue-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">Open Asks</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{account.openAsksText}</p></CardContent></Card>}
        </div>
      )}

      <Tabs defaultValue="updates">
        <TabsList>
          <TabsTrigger value="updates">Updates ({account.updates.length})</TabsTrigger>
          <TabsTrigger value="requests">Feature Requests ({allFeatureRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="updates" className="mt-4 space-y-3">
          <AccountDetailClient.AddUpdateButton accountId={account.id} />
          {account.updates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No updates yet</p>
              <p className="text-sm">Add a meeting note or CSM update to track account health.</p>
            </div>
          ) : (
            account.updates.map((u) => (
              <Card key={u.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={u.sentiment === 'POSITIVE' ? 'success' : u.sentiment === 'NEGATIVE' ? 'destructive' : 'secondary'}>{u.sentiment}</Badge>
                    <Badge variant={u.urgencyLevel === 'CRITICAL' ? 'destructive' : u.urgencyLevel === 'HIGH' ? 'warning' : 'outline'}>{u.urgencyLevel}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(u.createdAt)}</span>
                  </div>
                  {u.summaryText && <p className="text-sm mb-2">{u.summaryText}</p>}
                  {u.feedbackText && <p className="text-sm text-muted-foreground">{u.feedbackText}</p>}
                  {(u.featureRequestsJson as unknown as string[])?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(u.featureRequestsJson as unknown as string[]).map((fr, i) => (
                        <span key={i} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">{fr}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {allFeatureRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No feature requests extracted</p>
              <p className="text-sm">Add account updates with feature requests to see them here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from(new Set(allFeatureRequests)).map((fr, i) => (
                <Card key={i}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <p className="text-sm">{fr}</p>
                    <Badge variant="secondary" className="text-xs shrink-0">{allFeatureRequests.filter((r) => r === fr).length}×</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
