'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  MessageCircle, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export type FeedbackType =
  | 'BUG' | 'IMPROVEMENT' | 'CUSTOMER_REQUEST' | 'DOCS_ISSUE'
  | 'CONFUSION' | 'CONFIG_ISSUE' | 'COMPETITIVE' | 'ENABLEMENT_GAP'

export type FeedbackStatus = 'OPEN' | 'IN_REVIEW' | 'ADDRESSED' | 'CLOSED'

interface FeedbackItem {
  id: string
  featureId: string
  title: string
  content: string
  type: FeedbackType
  submittedBy: string
  status: FeedbackStatus
  tags: string
  createdAt: string
}

const TYPE_CONFIG: Record<FeedbackType, { label: string; color: string }> = {
  BUG:             { label: 'Bug',              color: 'bg-red-100 text-red-800 border-red-200' },
  IMPROVEMENT:     { label: 'Improvement',      color: 'bg-blue-100 text-blue-800 border-blue-200' },
  CUSTOMER_REQUEST:{ label: 'Customer Request', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  DOCS_ISSUE:      { label: 'Docs Issue',       color: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONFUSION:       { label: 'Confusion',        color: 'bg-orange-100 text-orange-800 border-orange-200' },
  CONFIG_ISSUE:    { label: 'Config Issue',     color: 'bg-rose-100 text-rose-800 border-rose-200' },
  COMPETITIVE:     { label: 'Competitive',      color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  ENABLEMENT_GAP:  { label: 'Enablement Gap',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string }> = {
  OPEN:      { label: 'Open',       color: 'bg-gray-100 text-gray-700' },
  IN_REVIEW: { label: 'In Review',  color: 'bg-amber-100 text-amber-800' },
  ADDRESSED: { label: 'Addressed',  color: 'bg-emerald-100 text-emerald-800' },
  CLOSED:    { label: 'Closed',     color: 'bg-slate-100 text-slate-600' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Feedback Card ────────────────────────────────────────────────────────────
function FeedbackCard({ item, onStatusChange, onDelete }: {
  item: FeedbackItem
  onStatusChange: (id: string, status: FeedbackStatus) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const tc = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.IMPROVEMENT
  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.OPEN
  const tags: string[] = (() => { try { return JSON.parse(item.tags) } catch { return [] } })()

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${item.status === 'CLOSED' ? 'opacity-60' : ''}`}>
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tc.color}`}>{tc.label}</span>
            <span className="text-sm font-medium truncate">{item.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{item.submittedBy} · {timeAgo(item.createdAt)}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
            {tags.map((t) => (
              <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            className="p-1 rounded hover:bg-muted text-destructive/70"
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          ><Trash2 className="h-3.5 w-3.5" /></button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 pb-4 space-y-3">
          {item.content && (
            <p className="text-sm leading-relaxed whitespace-pre-line pt-3">{item.content}</p>
          )}
          {/* Status actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">Update status:</span>
            {(['OPEN', 'IN_REVIEW', 'ADDRESSED', 'CLOSED'] as FeedbackStatus[])
              .filter((s) => s !== item.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(item.id, s)}
                  className={`text-xs px-2 py-0.5 rounded border hover:opacity-80 transition-opacity ${STATUS_CONFIG[s].color} border-current/20`}
                >
                  {s === 'ADDRESSED' && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
                  {STATUS_CONFIG[s].label}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Submit Dialog ────────────────────────────────────────────────────────────
function FeedbackFormDialog({ open, onClose, onSubmit }: {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; content: string; type: FeedbackType; submittedBy: string; tags: string[] }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<FeedbackType>('IMPROVEMENT')
  const [submittedBy, setSubmittedBy] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    try {
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
      await onSubmit({ title: title.trim(), content: content.trim(), type, submittedBy: submittedBy.trim(), tags })
      setTitle(''); setContent(''); setSubmittedBy(''); setTagsStr('')
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Your Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} placeholder="CSM, Support, Sales…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title / Summary</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Config steps are unclear for multi-tenant setup" />
          </div>
          <div className="space-y-1.5">
            <Label>Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Provide more context, customer quotes, reproduction steps, or examples…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tags <span className="text-muted-foreground font-normal">(comma separated, optional)</span></Label>
            <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="admin, onboarding, v3.1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting…' : 'Submit Feedback'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function FeedbackPanel({ featureId }: { featureId: string }) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/features/${featureId}/feedback`)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [featureId])

  const handleSubmit = async (data: any) => {
    const res = await fetch(`/api/features/${featureId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error()
    const item = await res.json()
    setItems((prev) => [item, ...prev])
    toast.success('Feedback submitted')
  }

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    try {
      await fetch(`/api/features/${featureId}/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setItems((prev) => prev.map((f) => f.id === id ? { ...f, status } : f))
    } catch { toast.error('Failed to update status') }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/features/${featureId}/feedback/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((f) => f.id !== id))
      toast.success('Feedback removed')
    } catch { toast.error('Failed to delete') }
  }

  const filtered = items.filter((f) => {
    return (statusFilter === 'ALL' || f.status === statusFilter) &&
           (typeFilter === 'ALL' || f.type === typeFilter)
  })

  const openCount = items.filter((f) => f.status === 'OPEN').length
  const inReviewCount = items.filter((f) => f.status === 'IN_REVIEW').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {openCount > 0 && <Badge variant="secondary" className="text-xs">{openCount} open</Badge>}
          {inReviewCount > 0 && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">{inReviewCount} in review</Badge>}
          {items.length === 0 && <span className="text-sm text-muted-foreground">No feedback yet</span>}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Submit Feedback
        </Button>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL', 'OPEN', 'IN_REVIEW', 'ADDRESSED', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
          <div className="h-4 w-px bg-border" />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-7 text-xs w-40 border-border">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <MessageCircle className="h-7 w-7 opacity-30" />
          <p className="text-sm">{items.length > 0 ? 'No items match your filters' : 'No feedback yet'}</p>
          {items.length === 0 && (
            <p className="text-xs max-w-xs">
              Collect bugs, improvement ideas, customer insights, docs gaps, and competitive observations here
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <FeedbackFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
