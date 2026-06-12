'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ExternalLink, X, MessageSquare, History, GitBranch,
  Layers, Send, AlertCircle, ChevronRight, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type JiraUser = { displayName: string; avatarUrls: { '24x24': string } }

type JiraComment = {
  id: string
  author: JiraUser
  body: string
  created: string
}

type JiraChangelogItem = {
  field: string
  fromString: string | null
  toString: string
}

type JiraChangelogEntry = {
  created: string
  author: string
  items: JiraChangelogItem[]
}

type JiraTicket = {
  key: string
  summary: string
  status: { name: string; statusCategory: { colorName: string } }
  issuetype: { name: string }
  priority: { name: string }
  assignee: JiraUser | null
  reporter: JiraUser | null
  description: string | null
  epic: { key: string; summary: string } | null
  subtasks: Array<{ key: string; summary: string; status: string }>
  comments: JiraComment[]
  changelog: JiraChangelogEntry[]
  availableTransitions: Array<{ id: string; name: string }>
  isMock?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusCategoryColor(colorName: string) {
  const map: Record<string, string> = {
    'green':     'bg-emerald-50 text-emerald-700 border-emerald-200',
    'yellow':    'bg-amber-50 text-amber-700 border-amber-200',
    'blue-gray': 'bg-slate-50 text-slate-600 border-slate-200',
    'warm-red':  'bg-red-50 text-red-700 border-red-200',
  }
  return map[colorName] ?? 'bg-muted text-muted-foreground border-border'
}

function Avatar({ user, size = 24 }: { user: JiraUser | null | undefined; size?: number }) {
  const initials = user?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  if (user?.avatarUrls?.['24x24'] && !user.avatarUrls['24x24'].includes('gravatar')) {
    return (
      <img
        src={user.avatarUrls['24x24']}
        alt={user.displayName}
        width={size}
        height={size}
        className="rounded-full"
      />
    )
  }

  return (
    <div
      className="rounded-full bg-violet-100 text-violet-700 font-semibold flex items-center justify-center text-xs shrink-0"
      style={{ width: size, height: size, fontSize: size < 24 ? 10 : 12 }}
    >
      {initials}
    </div>
  )
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  jiraKey: string
  /** Base URL for Jira links — e.g. https://mycompany.atlassian.net */
  jiraBaseUrl?: string
  onStatusChanged?: (key: string, newStatus: string) => void
}

export function JiraTicketDrawer({ open, onOpenChange, jiraKey, jiraBaseUrl, onStatusChanged }: Props) {
  const [ticket, setTicket] = React.useState<JiraTicket | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [commentText, setCommentText] = React.useState('')
  const [submittingComment, setSubmittingComment] = React.useState(false)
  const [statusUpdating, setStatusUpdating] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'details' | 'activity' | 'comments'>('details')
  const commentsEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open || !jiraKey) return
    setTicket(null)
    setError(null)
    setCommentText('')
    setActiveTab('details')
    setLoading(true)
    fetch(`/api/jira/ticket/${encodeURIComponent(jiraKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setTicket(data)
      })
      .catch(() => setError('Failed to load ticket'))
      .finally(() => setLoading(false))
  }, [open, jiraKey])

  async function handleStatusChange(transitionId: string) {
    if (!ticket) return
    const transition = ticket.availableTransitions.find((t) => t.id === transitionId)
    if (!transition) return

    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/jira/ticket/${encodeURIComponent(jiraKey)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transitionId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      setTicket((prev) => prev ? {
        ...prev,
        status: {
          ...prev.status,
          name: transition.name,
        },
      } : prev)
      onStatusChanged?.(jiraKey, transition.name)
      toast.success(`Status changed to "${transition.name}"`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    } finally { setStatusUpdating(false) }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/jira/ticket/${encodeURIComponent(jiraKey)}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const newComment: JiraComment = await res.json()
      setTicket((prev) => prev ? {
        ...prev,
        comments: [...prev.comments, newComment],
      } : prev)
      setCommentText('')
      setActiveTab('comments')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      toast.success('Comment posted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to post comment')
    } finally { setSubmittingComment(false) }
  }

  const jiraIssueUrl = jiraBaseUrl
    ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${jiraKey}`
    : `https://jira.atlassian.net/browse/${jiraKey}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col overflow-hidden"
        // hide the default X button — we provide our own in the header
        style={{ ['--sheet-close-display' as string]: 'none' }}
      >
        {/* ── Header ── */}
        <SheetHeader className="shrink-0 border-b px-5 py-4 flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <a
                href={jiraIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-mono font-semibold text-violet-700 hover:text-violet-900 hover:underline"
              >
                {jiraKey}
                <ExternalLink className="h-3 w-3" />
              </a>
              {ticket?.issuetype && (
                <Badge variant="outline" className="text-xs font-normal">{ticket.issuetype.name}</Badge>
              )}
              {ticket?.isMock && (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-dashed">
                  Demo data
                </Badge>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-5 w-64 mt-1" />
            ) : ticket ? (
              <p className="text-sm font-medium line-clamp-2 leading-snug">{ticket.summary}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {/* ── Status bar ── */}
        {(loading || ticket) && (
          <div className="shrink-0 border-b px-5 py-2.5 flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-7 w-36" />
            ) : ticket ? (
              <>
                <Select
                  value={ticket.availableTransitions.find((t) => t.name === ticket.status.name)?.id ?? ''}
                  onValueChange={handleStatusChange}
                  disabled={statusUpdating}
                >
                  <SelectTrigger
                    className={`h-7 text-xs font-medium w-36 border ${statusCategoryColor(ticket.status.statusCategory.colorName)}`}
                  >
                    <SelectValue placeholder={ticket.status.name} />
                  </SelectTrigger>
                  <SelectContent>
                    {ticket.availableTransitions.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ticket.assignee && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar user={ticket.assignee} size={18} />
                    <span>{ticket.assignee.displayName}</span>
                  </div>
                )}
                {ticket.priority && (
                  <span className="text-xs text-muted-foreground ml-auto">{ticket.priority.name}</span>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="shrink-0 border-b flex">
          {(['details', 'activity', 'comments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 capitalize ${
                activeTab === tab
                  ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab === 'details' && <Layers className="h-3.5 w-3.5" />}
              {tab === 'activity' && <History className="h-3.5 w-3.5" />}
              {tab === 'comments' && <MessageSquare className="h-3.5 w-3.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'comments' && ticket && ticket.comments.length > 0 && (
                <span className="ml-1 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0 rounded-full font-semibold">
                  {ticket.comments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading && <LoadingSkeleton />}

          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-5">
              <AlertCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm font-medium">Failed to load ticket</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          )}

          {!loading && ticket && (
            <>
              {/* ── Details Tab ── */}
              {activeTab === 'details' && (
                <div className="p-5 space-y-5">
                  {/* Description */}
                  {ticket.description && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Description</p>
                      <p className="text-sm text-foreground whitespace-pre-line">{ticket.description}</p>
                    </div>
                  )}

                  {/* Epic */}
                  {ticket.epic && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Parent Epic</p>
                      <div className="flex items-center gap-2 border rounded-lg p-3">
                        <Layers className="h-4 w-4 text-violet-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-mono font-medium text-violet-700">{ticket.epic.key}</span>
                          <p className="text-xs text-muted-foreground truncate">{ticket.epic.summary}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Child stories / subtasks */}
                  {ticket.subtasks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Child Stories ({ticket.subtasks.length})
                      </p>
                      <div className="space-y-1.5">
                        {ticket.subtasks.map((s) => (
                          <div key={s.key} className="flex items-center gap-2 border rounded-lg p-2.5">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-mono text-muted-foreground shrink-0">{s.key}</span>
                            <span className="text-xs flex-1 truncate">{s.summary}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${
                                s.status === 'Done'
                                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                  : s.status === 'In Progress'
                                  ? 'border-amber-200 text-amber-700 bg-amber-50'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {s.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reporter / Assignee */}
                  <div className="grid grid-cols-2 gap-3">
                    {ticket.reporter && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Reporter</p>
                        <div className="flex items-center gap-1.5">
                          <Avatar user={ticket.reporter} size={20} />
                          <span className="text-sm">{ticket.reporter.displayName}</span>
                        </div>
                      </div>
                    )}
                    {ticket.assignee && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Assignee</p>
                        <div className="flex items-center gap-1.5">
                          <Avatar user={ticket.assignee} size={20} />
                          <span className="text-sm">{ticket.assignee.displayName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Activity Tab ── */}
              {activeTab === 'activity' && (
                <div className="p-5">
                  {ticket.changelog.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">No activity yet</div>
                  ) : (
                    <div className="space-y-0">
                      {[...ticket.changelog].reverse().map((entry, i) => (
                        <div key={i} className="flex gap-3 pb-4 relative">
                          {/* Timeline line */}
                          {i < ticket.changelog.length - 1 && (
                            <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border" />
                          )}
                          <div className="h-7 w-7 rounded-full bg-muted border flex items-center justify-center shrink-0 z-10">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 pt-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-medium">{entry.author ?? 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">{relativeTime(entry.created)}</span>
                            </div>
                            {entry.items.map((item, j) => (
                              <p key={j} className="text-xs text-muted-foreground">
                                Changed <span className="font-medium text-foreground">{item.field}</span>{' '}
                                {item.fromString && (
                                  <>from <span className="font-medium text-foreground">{item.fromString}</span>{' '}</>
                                )}
                                to <span className="font-medium text-foreground">{item.toString}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Comments Tab ── */}
              {activeTab === 'comments' && (
                <div className="p-5">
                  {ticket.comments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No comments yet</div>
                  ) : (
                    <div className="space-y-4">
                      {ticket.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar user={comment.author} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-xs font-semibold">{comment.author.displayName}</span>
                              <span className="text-[10px] text-muted-foreground">{relativeTime(comment.created)}</span>
                            </div>
                            <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                              <p className="text-sm whitespace-pre-line">{comment.body}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={commentsEndRef} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Sticky Footer: Comment Input ── */}
        {ticket && (
          <form
            onSubmit={handleSubmitComment}
            className="shrink-0 border-t bg-background px-5 py-3 flex items-end gap-2"
          >
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="flex-1 resize-none text-sm min-h-[52px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (commentText.trim()) handleSubmitComment(e as unknown as React.FormEvent)
                }
              }}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 px-3 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
              disabled={submittingComment || !commentText.trim()}
            >
              {submittingComment ? (
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
