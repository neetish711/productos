'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui.store'
import { useProductStore } from '@/store/product.store'
import {
  LayoutDashboard, Map, Puzzle, Users2, Swords, BookOpen, Workflow,
  Wand2, Settings, ChevronLeft, ChevronRight, Zap, Building2,
  GitCompare, Shield, Bell, Link2, BarChart3, Trophy, FolderInput,
  Package, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Roadmaps', icon: Map,
    children: [
      { label: 'Main Roadmap', href: '/roadmap' },
      { label: 'AI Suggested', href: '/roadmap/ai-suggested' },
    ],
  },
  {
    label: 'Features', icon: Puzzle,
    children: [
      { label: 'Our Features', href: '/features' },
      { label: 'Comparisons', href: '/comparisons' },
    ],
  },
  {
    label: 'Competitors', icon: Swords,
    children: [
      { label: 'Inventory', href: '/competitors' },
      { label: 'Battle Cards', href: '/battle-cards' },
      { label: 'Key Updates', href: '/key-updates' },
    ],
  },
  {
    label: 'Accounts', icon: Building2,
    children: [
      { label: 'Client Directory', href: '/accounts' },
    ],
  },
  { label: 'Spec Library', href: '/specs', icon: BookOpen },
  {
    label: 'Workflows', icon: Workflow,
    children: [
      { label: 'Active Runs', href: '/workflows' },
      { label: 'History', href: '/workflows/history' },
    ],
  },
  { label: 'Import Data', href: '/import', icon: FolderInput },
  { label: 'Prompt Management', href: '/prompts', icon: Wand2 },
  { label: 'LLM Config', href: '/llm-config', icon: Zap },
  { label: 'Integrations', href: '/integrations', icon: Link2 },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const

type NavItemType = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  children?: { label: string; href: string }[]
}

type ProductOption = { id: string; name: string }

export function Sidebar({ products = [], selectedProductId = null }: {
  products?: ProductOption[]
  selectedProductId?: string | null
}) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const pathname = usePathname()
  const { data: session } = useSession()

  const userRole = (session?.user as { role?: string })?.role || ''
  const isAdminUser = ['SUPER_ADMIN', 'SENIOR_PM', 'PM', 'ADMIN'].includes(userRole)

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'relative flex flex-col border-r bg-background transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}>
        {/* Logo */}
        <div className={cn('flex items-center h-14 border-b px-4', collapsed && 'justify-center px-0')}>
          {!collapsed && (
            <span className="font-bold text-lg text-primary">ProductOS</span>
          )}
          {collapsed && <Trophy className="h-5 w-5 text-primary" />}
        </div>

        {/* AUDIT S3-8: inline product switcher — label + list come from the same
            server-resolved source as the data-scoping cookie (no localStorage desync). */}
        <ProductSwitcher products={products} selectedProductId={selectedProductId} collapsed={collapsed} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {(NAV_ITEMS as unknown as NavItemType[]).map((item) => (
            <NavItem key={item.label} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </nav>

        {/* Admin Section */}
        {isAdminUser && (
          <div className="border-t px-2 py-2">
            {!collapsed && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    collapsed && 'justify-center',
                    (pathname === '/admin' || pathname.startsWith('/admin/')) && 'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {!collapsed && 'Admin Panel'}
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Admin Panel</TooltipContent>}
            </Tooltip>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={toggle}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="ml-1 text-xs text-muted-foreground">Collapse</span>}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function ProductSwitcher({ products, selectedProductId, collapsed }: {
  products: ProductOption[]
  selectedProductId: string | null
  collapsed: boolean
}) {
  const router = useRouter()
  const setStoreProduct = useProductStore((s) => s.setSelectedProduct)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = products.find((p) => p.id === selectedProductId) ?? null

  // Keep the label store in sync with the server truth (for any other consumers).
  useEffect(() => {
    setStoreProduct(current?.id ?? null, current?.name ?? null)
  }, [current?.id, current?.name, setStoreProduct])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function selectProduct(id: string) {
    if (id === selectedProductId) { setOpen(false); return }
    setSwitching(true)
    try {
      const res = await fetch('/api/user/select-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      })
      if (!res.ok) throw new Error()
      setOpen(false)
      router.refresh() // re-scope all data + re-resolve the label from the cookie
    } catch {
      toast.error('Could not switch product')
    } finally {
      setSwitching(false)
    }
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/products" className="flex items-center justify-center border-b px-0 py-2.5 hover:bg-accent">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{current?.name || 'Select product'}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="relative border-b" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
      >
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium flex-1 text-left">{current?.name || 'Select product...'}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 max-h-72 overflow-y-auto border-b bg-background shadow-md">
          {products.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No products available.</p>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent',
                  p.id === selectedProductId && 'bg-accent/60 font-medium'
                )}
              >
                <span className="truncate">{p.name}</span>
              </button>
            ))
          )}
          <Link
            href="/products"
            onClick={() => setOpen(false)}
            className="block border-t px-4 py-2 text-xs text-muted-foreground hover:bg-accent"
          >
            Manage products →
          </Link>
        </div>
      )}
    </div>
  )
}

function NavItem({ item, collapsed, pathname }: {
  item: NavItemType
  collapsed: boolean
  pathname: string
}) {
  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false
  const hasChildren = 'children' in item && item.children

  if (hasChildren) {
    return (
      <div className="space-y-0.5">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </div>
        )}
        {item.children!.map((child) => {
          const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
          return (
            <Tooltip key={child.href}>
              <TooltipTrigger asChild>
                <Link
                  href={child.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    collapsed ? 'justify-center' : 'pl-6',
                    childActive && 'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  {!collapsed && child.label}
                  {collapsed && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{child.label}</TooltipContent>}
            </Tooltip>
          )
        })}
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href!}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
            collapsed && 'justify-center',
            isActive && 'bg-accent text-accent-foreground font-medium'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && item.label}
        </Link>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
    </Tooltip>
  )
}
