import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getSelectedProductId, getAccessibleProductIds } from '@/lib/product-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  LayoutDashboard,
  Swords,
  Map,
  Building2,
  Plus,
  Zap,
  FileText,
  Sparkles,
  Package,
} from 'lucide-react'

export default async function DashboardPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const userId = session.user.id
  const userRole = session.user.role

  // Get selected product or fall back to first accessible one
  const selectedProductId = await getSelectedProductId(userId, orgId, userRole)
  const accessibleProductIds = await getAccessibleProductIds(userId, orgId, userRole)

  // Product filter for queries
  const productFilter = selectedProductId
    ? { productId: selectedProductId }
    : { productId: { in: accessibleProductIds } }

  // AUDIT S3-9: scope competitor/account counts to the selected product (matching
  // features/roadmap) so switching products updates every card consistently.
  // Org-wide (productId: null) records still count within the org.
  const productScope = selectedProductId
    ? { OR: [{ productId: selectedProductId }, { productId: null }] }
    : {}

  const [org, selectedProduct, competitors, accounts, aiSuggestions, recentUpdates] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    selectedProductId ? prisma.product.findUnique({
      where: { id: selectedProductId },
      include: { _count: { select: { ourFeatures: true, roadmapItems: true } } },
    }) : null,
    prisma.competitor.count({ where: { organizationId: orgId, ...productScope } }),
    // AUDIT S3-9: "Open Accounts" now excludes churned accounts.
    prisma.account.count({ where: { organizationId: orgId, healthStatus: { not: 'CHURNED' }, ...productScope } }),
    prisma.roadmapItem.count({
      where: { ...productFilter, isAiSuggested: true, dismissedAt: null },
    }),
    prisma.competitorKeyUpdate.findMany({
      where: { competitor: { organizationId: orgId } },
      include: { competitor: { select: { name: true } } },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    }),
  ])

  const totalFeatures = selectedProduct?._count.ourFeatures ?? 0
  const totalRoadmap = selectedProduct?._count.roadmapItems ?? 0

  const recentRoadmapItems = await prisma.roadmapItem.findMany({
    where: productFilter,
    include: { spec: { select: { id: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })

  const statusColor: Record<string, string> = {
    PROPOSED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DEFERRED: 'bg-gray-100 text-gray-700',
  }

  const updateTypeColor: Record<string, string> = {
    NEW_FEATURE: 'bg-green-100 text-green-800',
    ENHANCEMENT: 'bg-blue-100 text-blue-800',
    LAUNCH: 'bg-purple-100 text-purple-800',
    STRATEGIC_SHIFT: 'bg-orange-100 text-orange-800',
    PRICING_CHANGE: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {org?.name}
            {selectedProduct && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Package className="h-3 w-3" />
                {selectedProduct.name}
              </span>
            )}
          </p>
        </div>
        <Link href="/products">
          <Button variant="outline" size="sm" className="gap-2">
            <Package className="h-4 w-4" />
            Switch Product
          </Button>
        </Link>
      </div>

      {!selectedProductId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">
                No product selected. Please select a product to view its dashboard.
              </p>
            </div>
            <Link href="/products">
              <Button size="sm">Select Product</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Total Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalFeatures}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Swords className="h-4 w-4" /> Competitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{competitors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Map className="h-4 w-4" /> Roadmap Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRoadmap}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Open Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{accounts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Roadmap Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Roadmap Items</CardTitle>
            <Link href="/roadmap">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentRoadmapItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No roadmap items yet.</p>
            ) : (
              <div className="space-y-3">
                {recentRoadmapItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/roadmap`} className="text-sm font-medium hover:underline truncate block">
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.targetQuarter ?? 'No quarter'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[item.status]}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      {item.spec ? (
                        <Badge variant="secondary" className="text-xs">Spec</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">No Spec</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Competitor Updates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Competitor Updates</CardTitle>
            <Link href="/key-updates">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No competitor updates yet.</p>
            ) : (
              <div className="space-y-3">
                {recentUpdates.map((update) => (
                  <div key={update.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{update.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${updateTypeColor[update.updateType]}`}>
                        {update.updateType.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {update.competitor.name} · {new Date(update.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/features">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Feature
              </Button>
            </Link>
            <Link href="/competitors">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Competitor
              </Button>
            </Link>
            <Link href="/specs">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" /> Generate Spec
              </Button>
            </Link>
            <Link href="/workflows">
              <Button variant="outline" className="gap-2">
                <Zap className="h-4 w-4" /> Run Analysis
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions Preview */}
      {aiSuggestions > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {aiSuggestions} pending AI-suggested roadmap item{aiSuggestions !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-700">Review and promote suggestions to your roadmap.</p>
              </div>
            </div>
            <Link href="/roadmap/ai-suggested">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Review
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
