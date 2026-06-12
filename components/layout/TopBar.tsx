'use client'
import { Search, Plus, LogOut, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/store/ui.store'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { IdeaCaptureDialog } from '@/components/roadmap/IdeaCaptureDialog'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export function TopBar() {
  const { data: session } = useSession()
  const setSearchOpen = useUIStore((s) => s.setGlobalSearchOpen)
  const ideaOpen = useUIStore((s) => s.ideaAssistantOpen)
  const setIdeaOpen = useUIStore((s) => s.setIdeaAssistantOpen)

  return (
    <header className="h-14 border-b flex items-center gap-3 px-4 bg-background">
      <IdeaCaptureDialog open={ideaOpen} onOpenChange={setIdeaOpen} />
      {/* Global search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 h-8 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted flex-1 max-w-sm"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search anything...</span>
        <kbd className="ml-auto hidden md:inline-flex h-5 items-center gap-1 rounded border border-input bg-muted px-1.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* New Idea */}
      <Button size="sm" onClick={() => setIdeaOpen(true)}>
        <Plus className="h-4 w-4" />
        New Idea
      </Button>

      {/* Notifications */}
      <NotificationPanel />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {session?.user?.name ? getInitials(session.user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings"><User className="h-4 w-4 mr-2" />Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings"><Settings className="h-4 w-4 mr-2" />Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => signOut({ callbackUrl: '/login' })}>
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
