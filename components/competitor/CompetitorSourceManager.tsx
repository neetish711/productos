'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Search, RefreshCw, Pause, Play, Trash2, Edit2, Check, X, Globe, Loader2 } from 'lucide-react'
import { AddSourceDialog } from './AddSourceDialog'
import { SourceDiscoveryPanel } from './SourceDiscoveryPanel'
import { formatDistanceToNow } from 'date-fns'

interface CompetitorSource {
  id: string
  url: string
  domain: string | null
  sourceType: string
  label: string | null
  status: string
  priority: string
  crawlFrequency: string
  crawlDepth: number
  includePaths: string | null
  excludePaths: string | null
  notes: string | null
  isActive: boolean
  isAutoDiscovered: boolean
  lastCrawledAt: string | null
  lastSuccessAt: string | null
  lastChangeAt: string | null
  freshnessScore: number | null
  evidenceScore: number | null
  crawlHealthStatus: string | null
  createdAt: string
}

interface CompetitorSourceManagerProps {
  competitorId: string
  initialSources?: CompetitorSource[]
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  BLOCKED: 'bg-red-100 text-red-700',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  WEBSITE: 'bg-blue-100 text-blue-700',
  PRICING: 'bg-green-100 text-green-700',
  DOCS: 'bg-purple-100 text-purple-700',
  BLOG: 'bg-amber-100 text-amber-700',
  RELEASE_NOTES: 'bg-orange-100 text-orange-700',
  INTEGRATIONS: 'bg-cyan-100 text-cyan-700',
  TRUST: 'bg-slate-100 text-slate-700',
  GITHUB: 'bg-gray-100 text-gray-700',
  NEWS: 'bg-rose-100 text-rose-700',
  REDDIT: 'bg-red-100 text-red-700',
  YOUTUBE: 'bg-red-100 text-red-700',
  PRODUCT_HUNT: 'bg-orange-100 text-orange-700',
  CUSTOM: 'bg-slate-100 text-slate-600',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'text-red-600',
  NORMAL: 'text-slate-500',
  LOW: 'text-slate-400',
}

const SOURCE_TYPES = [
  'WEBSITE', 'PRICING', 'DOCS', 'BLOG', 'RELEASE_NOTES', 'INTEGRATIONS',
  'TRUST', 'GITHUB', 'REDDIT', 'YOUTUBE', 'PRODUCT_HUNT', 'NEWS', 'CUSTOM',
]
const FREQUENCIES = ['MANUAL', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']

function relativeTime(date: string | null) {
  if (!date) return 'Never'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return date }
}

export function CompetitorSourceManager({ competitorId, initialSources = [] }: CompetitorSourceManagerProps) {
  const [sources, setSources] = useState<CompetitorSource[]>(initialSources)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'OFFICIAL' | 'COMMUNITY' | 'OTHER'>('ALL')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<CompetitorSource>>({})
  const [crawlingId, setCrawlingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources`)
      if (res.ok) setSources(await res.json())
    } finally { setLoading(false) }
  }, [competitorId])

  useEffect(() => { if (initialSources.length === 0) loadSources() }, [initialSources.length, loadSources])

  const OFFICIAL_TYPES = new Set(['WEBSITE', 'PRICING', 'DOCS', 'RELEASE_NOTES', 'INTEGRATIONS', 'TRUST'])
  const COMMUNITY_TYPES = new Set(['REDDIT', 'PRODUCT_HUNT', 'YOUTUBE'])

  const filtered = sources.filter((s) => {
    if (filter === 'OFFICIAL' && !OFFICIAL_TYPES.has(s.sourceType)) return false
    if (filter === 'COMMUNITY' && !COMMUNITY_TYPES.has(s.sourceType)) return false
    if (filter === 'OTHER' && (OFFICIAL_TYPES.has(s.sourceType) || COMMUNITY_TYPES.has(s.sourceType))) return false
    if (search && !s.url.toLowerCase().includes(search.toLowerCase()) && !(s.label ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function toggleStatus(source: CompetitorSource) {
    const newStatus = source.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const newIsActive = newStatus === 'ACTIVE'
    setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, status: newStatus, isActive: newIsActive } : s))
    await fetch(`/api/competitors/${competitorId}/managed-sources/${source.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, isActive: newIsActive }),
    })
  }

  async function deleteSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id))
    const res = await fetch(`/api/competitors/${competitorId}/managed-sources/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete source'); loadSources() }
    else toast.success('Source removed')
  }

  async function crawlNow(source: CompetitorSource) {
    setCrawlingId(source.id)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources/${source.id}/crawl`, { method: 'POST' })
      if (res.ok) {
        const { source: updated } = await res.json()
        setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, ...updated } : s))
        toast.success('Crawl triggered')
      }
    } finally { setCrawlingId(null) }
  }

  function startEdit(source: CompetitorSource) {
    setEditingId(source.id)
    setEditData({ sourceType: source.sourceType, label: source.label ?? '', priority: source.priority, crawlFrequency: source.crawlFrequency, crawlDepth: source.crawlDepth, notes: source.notes ?? '' })
  }

  async function saveEdit(id: string) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        const updated = await res.json()
        setSources((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s))
        toast.success('Source updated')
        setEditingId(null)
      } else { toast.error('Failed to update source') }
    } finally { setSavingId(null) }
  }

  const lastCrawled = sources.reduce((latest, s) => {
    if (!s.lastCrawledAt) return latest
    if (!latest) return s.lastCrawledAt
    return new Date(s.lastCrawledAt) > new Date(latest) ? s.lastCrawledAt : latest
  }, null as string | null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {sources.length} source{sources.length === 1 ? '' : 's'} configured
            {lastCrawled ? ` · Last crawled ${relativeTime(lastCrawled)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDiscoverOpen(true)}>
            <Search className="mr-1.5 h-3.5 w-3.5" /> Discover Sources
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Source
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sources…"
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(['ALL', 'OFFICIAL', 'COMMUNITY', 'OTHER'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-muted-foreground/40'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Source List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sources…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {sources.length === 0 ? (
            <div className="space-y-3">
              <Globe className="mx-auto h-10 w-10 opacity-30" />
              <p className="font-medium">No sources configured yet</p>
              <p className="text-sm">Add sources manually or use Discover Sources to get started.</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => setDiscoverOpen(true)}>Discover Sources</Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>Add Manually</Button>
              </div>
            </div>
          ) : (
            <p>No sources match your filter.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((source) => (
            <div key={source.id} className="border rounded-lg p-4 space-y-3">
              {/* Source Header Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{source.label || source.domain || source.url}</span>
                    <Badge variant="secondary" className={`text-xs ${SOURCE_TYPE_COLORS[source.sourceType] ?? ''}`}>
                      {source.sourceType.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[source.status] ?? ''}`}>
                      {source.status}
                    </Badge>
                    {source.isAutoDiscovered && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Auto</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{source.url}</p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {editingId === source.id ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(source.id)} disabled={!!savingId}>
                        {savingId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(source)} title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => toggleStatus(source)}
                        title={source.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      >
                        {source.status === 'ACTIVE' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => crawlNow(source)}
                        disabled={crawlingId === source.id}
                        title="Crawl Now"
                      >
                        {crawlingId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteSource(source.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit mode */}
              {editingId === source.id && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <Select value={editData.sourceType} onValueChange={(v) => setEditData((p) => ({ ...p, sourceType: v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCE_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Priority</label>
                    <Select value={editData.priority} onValueChange={(v) => setEditData((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH" className="text-xs">High</SelectItem>
                        <SelectItem value="NORMAL" className="text-xs">Normal</SelectItem>
                        <SelectItem value="LOW" className="text-xs">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Frequency</label>
                    <Select value={editData.crawlFrequency} onValueChange={(v) => setEditData((p) => ({ ...p, crawlFrequency: v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Label</label>
                    <Input className="h-7 text-xs" value={editData.label ?? ''} onChange={(e) => setEditData((p) => ({ ...p, label: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Stats row */}
              {!editingId || editingId !== source.id ? (
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className={PRIORITY_COLORS[source.priority]}>{source.priority} priority</span>
                  <span>{source.crawlFrequency}</span>
                  <span>Depth {source.crawlDepth}</span>
                  <span>Crawled {relativeTime(source.lastCrawledAt)}</span>
                  {source.freshnessScore != null && (
                    <span>Freshness {Math.round(source.freshnessScore * 100)}%</span>
                  )}
                  {source.lastChangeAt && (
                    <span className="text-amber-600">Changed {relativeTime(source.lastChangeAt)}</span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <AddSourceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        competitorId={competitorId}
        onAdded={(s) => setSources((prev) => [s as any, ...prev])}
      />
      <SourceDiscoveryPanel
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        competitorId={competitorId}
        onAccepted={(newSources) => setSources((prev) => [...(newSources as any), ...prev])}
      />
    </div>
  )
}
