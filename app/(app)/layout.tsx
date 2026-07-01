import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { getSelectedProductId, getAccessibleProductIds } from '@/lib/product-context'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrgSession()
  const { id: userId, organizationId: orgId, role } = session.user as { id: string; organizationId: string; role: string }

  // AUDIT S3-8: resolve the selected product + accessible products server-side
  // (from the cookie) and pass them to the sidebar, so the switcher label and the
  // data-scoping cookie share ONE source of truth and can't desync.
  const [selectedProductId, accessibleIds] = await Promise.all([
    getSelectedProductId(userId, orgId, role),
    getAccessibleProductIds(userId, orgId, role),
  ])
  const products = await prisma.product.findMany({
    where: { id: { in: accessibleIds }, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar products={products} selectedProductId={selectedProductId} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-muted/20">
          {children}
        </main>
      </div>
      <GlobalSearchDialog />
    </div>
  )
}
