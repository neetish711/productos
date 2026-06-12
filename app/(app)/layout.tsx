import { requireOrgSession } from '@/lib/auth/utils'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOrgSession()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
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
