'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
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

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const pathname = usePathname()
  const { data: session } = useSession()
  const storeProductName = useProductStore((s) => s.selectedProductName)

  // Avoid hydration mismatch: only show product name after client mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const selectedProductName = mounted ? storeProductName : null

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

        {/* Product Selector */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/products"
              className={cn(
                'flex items-center gap-2 border-b px-4 py-2.5 text-sm transition-colors hover:bg-accent',
                collapsed && 'justify-center px-0'
              )}
            >
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              {!collapsed && (
                <span className="truncate font-medium">
                  {selectedProductName || 'Select product...'}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">
              {selectedProductName || 'Select product'}
            </TooltipContent>
          )}
        </Tooltip>

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
