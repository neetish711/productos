'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Source = {
  id: string
  url: string
  title: string
  snippet: string
  sourceType: string
  confidence: number
  featureId: string
  featureName: string
}

type Feature = { id: string; name: string }

const SOURCE_TYPES = ['webpage', 'blog', 'docs', 'pricing', 'news', 'twitter', 'linkedin', 'other']

function confidenceColor(c: number) {
  if (c >= 0.8) return 'text-emerald-700 bg-emerald-50'
  if (c >= 0.5) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

const emptyAdd = { featureId: '', url: '', title: '', snippet: '', sourceType: 'webpage', confidence: 0.8 }
const emptyEdit = { url: '', title: '', snippet: '', sourceType: 'webpage', confidence: 0.8 }

interface Props {
  competitorId: string
  competitorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SourceManagementSheet({ competitorId, competitorName, open, onOpenChange }: Props) {
  const [sources, setSources] = React.useState<Source[]>([])
  const [features, setFeatures] = React.useState<Feature[]>([])
  const [loading, setLoading] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editForm, setEditForm] = React.useState(emptyEdit)
  const [addOpen, setAddOpen] = React.useState(false)
  const [addForm, setAddForm] = React.useState(emptyAdd)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch(`/api/competitors/${competitorId}/sources`).then((r) => r.json()),
      fetch(`/api/competitors/${competitorId}/features`).then((r) => r.json()).catch(() => []),
    ]).then(([srcs, feats]) => {
      setSources(Array.isArray(srcs) ? srcs : [])
      setFeatures(Array.isArray(feats) ? feats : [])
    }).finally(() => setLoading(false))
  }, [open, competitorId])

  // Group by featureName
  const grouped = React.useMemo(() => {
    const map = new Map<string, Source[]>()
    for (const s of sources) {
      const key = s.featureName || 'Unknown feature'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [sources])

  function startEdit(s: Source) {
    setEditingId(s.id)
    setEditForm({ url: s.url, title: s.title, snippet: s.snippet, sourceType: s.sourceType, confidence: s.confidence })
  }

  async function saveEdit(sourceId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, confidence: Number(editForm.confidence) }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSources((prev) => prev.map((s) => s.id === sourceId ? { ...updated } : s))
      setEditingId(null)
      toast.success('Source updated')
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  async function deleteSource(sourceId: string) {
    try {
      const res = await fetch(`/api/competitors/${competitorId}/sources/${sourceId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
      toast.success('Source deleted')
    } catch { toast.error('Failed to delete') }
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, confidence: Number(addForm.confidence) }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setSources((prev) => [created, ...prev])
      setAddOpen(false)
      setAddForm(emptyAdd)
      toast.success('Source added')
    } catch { toast.error('Failed to add source') }
    finally { setSaving(false) }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="flex-row items-center justify-between pr-8">
            <SheetTitle>Sources — {competitorName}</SheetTitle>
            <Button size="sm" onClick={() => { setAddForm(emptyAdd); setAddOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Source
            </Button>
          </SheetHeader>

          <div className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No sources yet.</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAddOpen(true)}>Add first source</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(grouped.entries()).map(([featureName, featureSources]) => (
                  <div key={featureName}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{featureName}</h3>
                    <div className="space-y-2">
                      {featureSources.map((s) => (
                        <div key={s.id} className="border rounded-lg p-3">
                          {editingId === s.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editForm.url}
                                onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                                placeholder="URL"
                                className="text-sm h-8"
                              />
                              <Input
                                value={editForm.title}
                                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="Title"
                                className="text-sm h-8"
                              />
                              <Textarea
                                value={editForm.snippet}
                                onChange={(e) => setEditForm((f) => ({ ...f, snippet: e.target.value }))}
                                placeholder="Snippet"
                                rows={2}
                                className="text-sm resize-none"
                              />
                              <div className="flex gap-2">
                                <Select value={editForm.sourceType} onValueChange={(v) => setEditForm((f) => ({ ...f, sourceType: v }))}>
                                  <SelectTrigger className="h-8 text-sm flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  value={editForm.confidence}
                                  onChange={(e) => setEditForm((f) => ({ ...f, confidence: parseFloat(e.target.value) }))}
                                  placeholder="Confidence"
                                  className="text-sm h-8 w-24"
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => saveEdit(s.id)} disabled={saving}>
                                  {saving ? 'Saving…' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium truncate">{s.title || new URL(s.url).hostname}</p>
                                  <Badge variant="outline" className="text-xs font-normal">{s.sourceType}</Badge>
                                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${confidenceColor(s.confidence)}`}>
                                    {Math.round(s.confidence * 100)}%
                                  </span>
                                </div>
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate max-w-[300px]">{s.url.replace(/^https?:\/\//, '')}</span>
                                </a>
                                {s.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.snippet}</p>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(s)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSource(s.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Source Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Source</DialogTitle></DialogHeader>
          <form onSubmit={addSource} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Feature *</Label>
              <Select value={addForm.featureId} onValueChange={(v) => setAddForm((f) => ({ ...f, featureId: v }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a feature" />
                </SelectTrigger>
                <SelectContent>
                  {features.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input value={addForm.url} onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} placeholder="Page title" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Snippet</Label>
              <Textarea value={addForm.snippet} onChange={(e) => setAddForm((f) => ({ ...f, snippet: e.target.value }))} placeholder="Relevant excerpt" rows={2} className="text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Type</Label>
                <Select value={addForm.sourceType} onValueChange={(v) => setAddForm((f) => ({ ...f, sourceType: v }))}>
                  <SelectTrigger className="text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1.5">
                <Label>Confidence</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={addForm.confidence}
                  onChange={(e) => setAddForm((f) => ({ ...f, confidence: parseFloat(e.target.value) }))}
                  className="text-sm h-8"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !addForm.featureId || !addForm.url.trim()}>
                {saving ? 'Adding…' : 'Add Source'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
