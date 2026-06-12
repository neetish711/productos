'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Bell, CheckCheck, TrendingUp, FileText, Zap, Info } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: Date
  entityType: string | null
}

const TYPE_ICON: Record<string, typeof Bell> = {
  COMPETITOR_UPDATE: TrendingUp,
  SPEC_GENERATED: FileText,
  WORKFLOW_COMPLETE: Zap,
  GENERAL: Info,
}

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifications(await res.json())
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  const markAllRead = async () => {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    if (res.ok) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) fetchNotifications() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading...' : 'No notifications'}
            </div>
          ) : (
            <div>
              {notifications.map((n, i) => {
                const Icon = TYPE_ICON[n.type] || Bell
                return (
                  <div key={n.id}>
                    <button
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                      onClick={() => markRead(n.id)}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.read ? 'font-medium' : ''} leading-tight`}>{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
                    </button>
                    {i < notifications.length - 1 && <Separator />}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
