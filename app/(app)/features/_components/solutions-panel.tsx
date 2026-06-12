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
  Lightbulb, Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export type SolutionType = 'FAQ' | 'SETUP' | 'TROUBLESHOOT' | 'OBJECTION' | 'WORKAROUND' | 'LIMITATION' | 'SNIPPET'

interface Solution {
  id: string
  featureId: string
  title: string
  content: string
  type: SolutionType
  tags: string
  createdAt: string
}

const TYPE_CONFIG: Record<SolutionType, { label: string; color: string }> = {
  FAQ:          { label: 'FAQ',           color: 'bg-blue-100 text-blue-800 border-blue-200' },
  SETUP:        { label: 'Setup',         color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  TROUBLESHOOT: { label: 'Troubleshoot',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
  OBJECTION:    { label: 'Objection',     color: 'bg-rose-100 text-rose-800 border-rose-200' },
  WORKAROUND:   { label: 'Workaround',    color: 'bg-purple-100 text-purple-800 border-purple-200' },
  LIMITATION:   { label: 'Limitation',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
  SNIPPET:      { label: 'Snippet',       color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
}

// ─── Solution Card ─────────────────────────────────────────────────────────────
function SolutionCard({ s, onEdit, onDelete }: {
  s: Solution
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const tc = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.FAQ
  const tags: string[] = (() => { try { return JSON.parse(s.tags) } catch { return [] } })()

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tc.color}`}>
              {tc.label}
            </span>
            <span className="text-sm font-medium truncate">{s.title}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {tags.map((t) => (
                <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1 rounded hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
          ><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button
            className="p-1 rounded hover:bg-muted text-destructive/70"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          ><Trash2 className="h-3.5 w-3.5" /></button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t">
          <p className="text-sm leading-relaxed whitespace-pre-line pt-3">{s.content}</p>
        </div>
      )}
    </div>
  )
}

// ─── Form Dialog ──────────────────────────────────────────────────────────────
function SolutionFormDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean
  initial: Solution | null
  onClose: () => void
  onSave: (data: { title: string; content: string; type: SolutionType; tags: string[] }) => Promise<void>
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [type, setType] = useState<SolutionType>(initial?.type ?? 'FAQ')
  const [tagsStr, setTagsStr] = useState(() => {
    try { return (JSON.parse(initial?.tags ?? '[]') as string[]).join(', ') } catch { return '' }
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { toast.error('Title and content required'); return }
    setSaving(true)
    try {
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
      await onSave({ title: title.trim(), content: content.trim(), type, tags })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Solution' : 'Add Solution'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as SolutionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground font-normal">(comma separated)</span></Label>
              <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="setup, admin, v3" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How do I enable this for a specific tenant?" />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Write the answer, guidance, snippet, or approved response…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Solution'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function SolutionsPanel({ featureId }: { featureId: string }) {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SolutionType | 'ALL'>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Solution | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/features/${featureId}/solutions`)
      .then((r) => r.json())
      .then(setSolutions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [featureId])

  const handleSave = async (data: { title: string; content: string; type: SolutionType; tags: string[] }) => {
    if (editTarget) {
      const res = await fetch(`/api/features/${featureId}/solutions/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSolutions((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      toast.success('Solution updated')
    } else {
      const res = await fetch(`/api/features/${featureId}/solutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setSolutions((prev) => [created, ...prev])
      toast.success('Solution added')
    }
    setEditTarget(null)
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/features/${featureId}/solutions/${id}`, { method: 'DELETE' })
      setSolutions((prev) => prev.filter((s) => s.id !== id))
      toast.success('Solution removed')
    } catch { toast.error('Failed to delete') }
  }

  const filtered = solutions.filter((s) => {
    const matchType = typeFilter === 'ALL' || s.type === typeFilter
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const typeCounts: Partial<Record<SolutionType, number>> = {}
  for (const s of solutions) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search solutions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Solution
        </Button>
      </div>

      {/* Type filter pills */}
      {solutions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${typeFilter === 'ALL' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            All ({solutions.length})
          </button>
          {(Object.entries(typeCounts) as [SolutionType, number][]).map(([t, count]) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t === typeFilter ? 'ALL' : t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${typeFilter === t ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {TYPE_CONFIG[t]?.label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <Lightbulb className="h-7 w-7 opacity-30" />
          <p className="text-sm">{search || typeFilter !== 'ALL' ? 'No solutions match' : 'No solutions yet'}</p>
          {!search && typeFilter === 'ALL' && (
            <p className="text-xs">Add FAQs, setup guides, objection handlers, and approved responses</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SolutionCard
              key={s.id}
              s={s}
              onEdit={() => { setEditTarget(s); setDialogOpen(true) }}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      <SolutionFormDialog
        open={dialogOpen}
        initial={editTarget}
        onClose={() => { setDialogOpen(false); setEditTarget(null) }}
        onSave={handleSave}
      />
    </div>
  )
}
