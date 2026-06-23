'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, ExternalLink, ArrowRight, Swords, Search, SlidersHorizontal,
  CheckSquare, Square, RefreshCw, AlertCircle, Clock, Wifi, WifiOff,
  Database, TriangleAlert, ChevronDown, Shield, BookOpen, TrendingUp,
  Globe, FileText, Star, Briefcase, MessageSquare, Play,
  Filter, BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo, cn } from '@/lib/utils'
import { CrawlSetupModal } from '@/components/competitor/CrawlSetupModal'
import { SourceDiscoveryWizard } from '@/components/competitor/SourceDiscoveryWizard'
import { TagEditor } from '@/components/competitor/TagEditor'
import { SourceManagementSheet } from '@/components/competitor/SourceManagementSheet'

// ─── Types ───────────────────────────────────────────────────────────────────

type CompetitorHealth = {
  completeness: number
  confidenceScore: number
  evidenceBackedCount: number
  sourceCoverage: string[]
  sourceWarnings: number
  activeSourceCount: number
  lastSuccessfulCrawl: Date | null
  warnings: string[]
}

type Competitor = {
  id: string
  name: string
  website: string
  description: string
  monitoringEnabled: boolean
  setupStatus: string
  lastRefreshAt: Date | null
  reportStatus: string
  updatedAt: Date
  _count: { features: number; keyUpdates: number; managedSources: number }
  categories: string[]
  health?: CompetitorHealth
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-rose-500', 'bg-cyan-500',
]

const SOURCE_TYPE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  WEBSITE:       { icon: <Globe className="h-3 w-3" />,       label: 'Web' },
  DOCS:          { icon: <BookOpen className="h-3 w-3" />,     label: 'Docs' },
  BLOG:          { icon: <FileText className="h-3 w-3" />,     label: 'Blog' },
  PRICING:       { icon: <BarChart3 className="h-3 w-3" />,    label: 'Pricing' },
  RELEASE_NOTES: { icon: <Play className="h-3 w-3" />,         label: 'Changelog' },
  REDDIT:        { icon: <MessageSquare className="h-3 w-3" />,label: 'Reddit' },
  GITHUB:        { icon: <Shield className="h-3 w-3" />,       label: 'GitHub' },
  YOUTUBE:       { icon: <Play className="h-3 w-3" />,         label: 'YouTube' },
  TRUST:         { icon: <Shield className="h-3 w-3" />,       label: 'Trust' },
  INTEGRATIONS:  { icon: <TrendingUp className="h-3 w-3" />,   label: 'Integrations' },
  PRODUCT_HUNT:  { icon: <Star className="h-3 w-3" />,         label: 'PH' },
  NEWS:          { icon: <FileText className="h-3 w-3" />,     label: 'News' },
  CUSTOM:        { icon: <Database className="h-3 w-3" />,     label: 'Custom' },
}

function getMonitoringStatus(c: Competitor) {
  if (!c.monitoringEnabled) return { label: 'Paused', color: 'text-muted-foreground bg-muted', dotColor: 'bg-muted-foreground', icon: <WifiOff className="h-3 w-3" /> }
  if (!c.lastRefreshAt) return { label: 'Not crawled', color: 'text-amber-700 bg-amber-50', dotColor: 'bg-amber-500', icon: <Clock className="h-3 w-3" /> }
  const daysSince = (Date.now() - new Date(c.lastRefreshAt).getTime()) / 86_400_000
  if (daysSince < 7) return { label: 'Live', color: 'text-emerald-700 bg-emerald-50', dotColor: 'bg-emerald-500', icon: <Wifi className="h-3 w-3" /> }
  if (daysSince < 30) return { label: 'Monitoring', color: 'text-blue-700 bg-blue-50', dotColor: 'bg-blue-500', icon: <Wifi className="h-3 w-3" /> }
  return { label: 'Needs refresh', color: 'text-amber-700 bg-amber-50', dotColor: 'bg-amber-500', icon: <AlertCircle className="h-3 w-3" /> }
}

function getCompletenessColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function getConfidenceColor(score: number) {
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
}

type SortKey = 'name' | 'features' | 'updated' | 'completeness' | 'confidence'
type FilterStatus = 'all' | 'live' | 'paused' | 'warnings'

// ─── Main Component ───────────────────────────────────────────────────────────

export function CompetitorsClient({ initialCompetitors }: { initialCompetitors: Competitor[] }) {
  const [competitors, setCompetitors] = React.useState(initialCompetitors)
  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortKey>('updated')
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>('all')
  const [showFilterMenu, setShowFilterMenu] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [multiSelect, setMultiSelect] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)
  const [discoveryTarget, setDiscoveryTarget] = React.useState<{ id: string; name: string } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', website: '', description: '' })
  const [customTagsMap, setCustomTagsMap] = React.useState<Record<string, string[]>>({})
  const [crawlTarget, setCrawlTarget] = React.useState<Competitor | null>(null)
  const [crawlNames, setCrawlNames] = React.useState<string[]>([])
  const [crawlSources, setCrawlSources] = React.useState<{ url: string }[]>([])
  const [sourceTarget, setSourceTarget] = React.useState<Competitor | null>(null)

  React.useEffect(() => {
    const map: Record<string, string[]> = {}
    for (const c of competitors) {
      try {
        const stored = localStorage.getItem(`competitor_custom_tags_${c.id}`)
        if (stored) map[c.id] = JSON.parse(stored)
      } catch { /* ignore */ }
    }
    setCustomTagsMap(map)
  }, [competitors])

  const filtered = React.useMemo(() => {
    let list = competitors.filter((c) => {
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase()
        const customTags = customTagsMap[c.id] ?? []
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.description.toLowerCase().includes(q) &&
          !c.categories.some((cat) => cat.toLowerCase().includes(q)) &&
          !customTags.some((tag) => tag.toLowerCase().includes(q))
        ) return false
      }
      // Status filter
      if (filterStatus === 'live' && !c.monitoringEnabled) return false
      if (filterStatus === 'paused' && c.monitoringEnabled) return false
      if (filterStatus === 'warnings' && (!c.health?.warnings.length)) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'features') return b._count.features - a._count.features
      if (sortBy === 'completeness') return (b.health?.completeness ?? 0) - (a.health?.completeness ?? 0)
      if (sortBy === 'confidence') return (b.health?.confidenceScore ?? 0) - (a.health?.confidenceScore ?? 0)
      const ta = a.lastRefreshAt ? new Date(a.lastRefreshAt).getTime() : 0
      const tb = b.lastRefreshAt ? new Date(b.lastRefreshAt).getTime() : 0
      return tb - ta
    })
    return list
  }, [competitors, search, sortBy, filterStatus, customTagsMap])

  const warningCount = React.useMemo(
    () => competitors.filter((c) => c.health?.warnings.length).length,
    [competitors]
  )

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))
  }

  async function load() {
    const res = await fetch('/api/competitors')
    if (res.ok) setCompetitors(await res.json())
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monitoringEnabled: true }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      toast.success('Competitor added — discovering sources...')
      setAddOpen(false)
      setForm({ name: '', website: '', description: '' })
      load()
      // Open source discovery wizard for the new competitor
      setDiscoveryTarget({ id: created.id, name: form.name })
    } catch { toast.error('Failed to add') }
    finally { setSaving(false) }
  }

  function openCrawl(c: Competitor) {
    setCrawlTarget(c)
    setCrawlNames([c.name])
    setCrawlSources(c.website ? [{ url: c.website.startsWith('http') ? c.website : `https://${c.website}` }] : [])
  }

  function openBulkCrawl() {
    const sel = competitors.filter((c) => selected.has(c.id))
    if (!sel.length) return
    setCrawlTarget(sel[0])
    setCrawlNames(sel.map((c) => c.name))
    setCrawlSources(sel.filter((c) => c.website).map((c) => ({ url: c.website.startsWith('http') ? c.website : `https://${c.website}` })))
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="border-b px-6 py-4 flex items-center gap-3 bg-background flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search competitors, tags..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 text-xs">
          {([
            { key: 'all',      label: 'All' },
            { key: 'live',     label: 'Live' },
            { key: 'paused',   label: 'Paused' },
            { key: 'warnings', label: `Warnings${warningCount > 0 ? ` (${warningCount})` : ''}` },
          ] as { key: FilterStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                'px-2.5 py-1 rounded-full border transition-colors',
                filterStatus === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted text-muted-foreground',
                key === 'warnings' && warningCount > 0 && filterStatus !== key && 'border-amber-300 text-amber-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-1.5 text-xs border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Sort: {sortBy === 'updated' ? 'Last Updated' : sortBy === 'features' ? 'Features' : sortBy === 'completeness' ? 'Completeness' : sortBy === 'confidence' ? 'Confidence' : 'Name'}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full mt-1 right-0 z-20 bg-popover border rounded-lg shadow-lg p-1 min-w-40">
              {([
                { key: 'updated',      label: 'Last Updated' },
                { key: 'name',         label: 'Name (A–Z)' },
                { key: 'features',     label: 'Feature Count' },
                { key: 'completeness', label: 'Completeness' },
                { key: 'confidence',   label: 'Confidence' },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setSortBy(key); setShowFilterMenu(false) }}
                  className={cn(
                    'w-full text-left text-xs px-3 py-1.5 rounded hover:bg-muted transition-colors',
                    sortBy === key && 'text-primary font-medium'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant={multiSelect ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => { setMultiSelect(!multiSelect); setSelected(new Set()) }}
        >
          <Filter className="h-3.5 w-3.5 mr-1" />
          {multiSelect ? 'Cancel' : 'Select'}
        </Button>

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{filtered.length} competitor{filtered.length !== 1 ? 's' : ''}</span>
        <Button size="sm" onClick={() => { setForm({ name: '', website: '', description: '' }); setAddOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />Add Competitor
        </Button>
      </div>

      {/* ── Bulk action bar ── */}
      {multiSelect && selected.size > 0 && (
        <div className="bg-primary/5 border-b px-6 py-2 flex items-center gap-3">
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-sm font-medium">
            {selected.size === filtered.length ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
            {selected.size} selected
          </button>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={openBulkCrawl}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Re-crawl selected
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            {search || filterStatus !== 'all' ? (
              <>
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium">No competitors match your filters</p>
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterStatus('all') }}>Clear filters</Button>
              </>
            ) : (
              <>
                <Swords className="h-12 w-12 text-muted-foreground/30" />
                <p className="font-semibold text-lg">No competitors tracked yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add competitors to track features, monitor product changes, and build battle cards.
                </p>
                <Button onClick={() => setAddOpen(true)} className="mt-2">
                  <Plus className="h-4 w-4 mr-1" />Add First Competitor
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl">
            {filtered.map((c, i) => {
              const status = getMonitoringStatus(c)
              const isSelected = selected.has(c.id)
              const health = c.health
              const completeness = health?.completeness ?? 0
              const confidence = health?.confidenceScore ?? 0
              const hasWarnings = (health?.warnings.length ?? 0) > 0

              return (
                <div
                  key={c.id}
                  className={cn(
                    'group border rounded-xl bg-card flex flex-col transition-all',
                    multiSelect ? 'cursor-pointer hover:border-primary/60' : 'hover:shadow-md hover:border-primary/30',
                    isSelected && 'border-primary ring-1 ring-primary/30',
                    hasWarnings && !isSelected && 'border-amber-200/70'
                  )}
                  onClick={multiSelect ? () => toggleSelect(c.id) : undefined}
                >
                  {/* ── Card Header ── */}
                  <div className="p-4 flex items-start gap-3">
                    {multiSelect && (
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0', AVATAR_COLORS[i % AVATAR_COLORS.length])}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-sm leading-tight">{c.name}</h2>
                      {c.website && (
                        <a
                          href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => { if (multiSelect) e.preventDefault(); else e.stopPropagation() }}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {c.website.replace(/^https?:\/\//, '').split('/')[0]}
                        </a>
                      )}
                    </div>
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0', status.color)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.dotColor)} />
                      {status.label}
                    </span>
                  </div>

                  {/* ── Intelligence Health ── */}
                  <div className="px-4 pb-3 space-y-2">
                    {/* Completeness + Confidence */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Research</span>
                          <span className="text-xs font-semibold">{completeness}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', getCompletenessColor(completeness))}
                            style={{ width: `${completeness}%` }}
                          />
                        </div>
                      </div>
                      {confidence > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className={cn('text-sm font-bold leading-tight', getConfidenceColor(confidence))}>
                            {confidence}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Source coverage icons */}
                    {health && health.sourceCoverage.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {health.sourceCoverage.slice(0, 7).map((type) => {
                          const meta = SOURCE_TYPE_META[type]
                          if (!meta) return null
                          return (
                            <span
                              key={type}
                              title={meta.label}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                            >
                              {meta.icon}
                              <span className="text-[10px]">{meta.label}</span>
                            </span>
                          )
                        })}
                        {health.sourceCoverage.length > 7 && (
                          <span className="text-[10px] text-muted-foreground">+{health.sourceCoverage.length - 7}</span>
                        )}
                      </div>
                    )}

                    {/* Warning chips */}
                    {hasWarnings && (
                      <div className="flex items-start gap-1 flex-wrap">
                        {health!.warnings.slice(0, 2).map((w, wi) => (
                          <span key={wi} className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            <TriangleAlert className="h-2.5 w-2.5" />{w}
                          </span>
                        ))}
                        {health!.warnings.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{health!.warnings.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Tags ── */}
                  <div className="px-4 pb-3">
                    <TagEditor
                      competitorId={c.id}
                      categoryTags={c.categories}
                      onTagsChange={(tags) => setCustomTagsMap((prev) => ({ ...prev, [c.id]: tags }))}
                    />
                  </div>

                  {/* ── Quick Actions (hover) ── */}
                  {!multiSelect && (
                    <div className="hidden group-hover:flex items-center gap-1 px-3 pb-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openCrawl(c) }}>
                        <RefreshCw className="h-3 w-3 mr-1" />Re-crawl
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSourceTarget(c) }}>
                        <Database className="h-3 w-3 mr-1" />Sources
                      </Button>
                    </div>
                  )}

                  {/* ── Footer ── */}
                  <div className="mt-auto border-t px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground font-semibold">{c._count.features}</strong>
                        {health?.evidenceBackedCount !== undefined && health.evidenceBackedCount > 0 && (
                          <span className="text-muted-foreground/70"> ({health.evidenceBackedCount} sourced)</span>
                        )}
                        {' '}features
                      </span>
                      {c._count.keyUpdates > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <strong className="text-foreground font-semibold">{c._count.keyUpdates}</strong> updates
                        </span>
                      )}
                      {health?.lastSuccessfulCrawl && (
                        <span title="Last successful crawl">{timeAgo(health.lastSuccessfulCrawl)}</span>
                      )}
                    </div>
                    {!multiSelect && (
                      <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary shrink-0 -mr-1 text-xs h-7">
                        <Link href={`/competitors/${c.id}`}>
                          View Intelligence<ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Add Competitor Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Competitor</DialogTitle></DialogHeader>
          <form onSubmit={onAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Zendesk" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://zendesk.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What do they do?" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Adding...' : 'Add Competitor'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Crawl Setup Modal ── */}
      <CrawlSetupModal
        open={!!crawlTarget}
        onOpenChange={(v) => { if (!v) setCrawlTarget(null) }}
        competitorNames={crawlNames}
        initialSources={crawlSources}
        onComplete={load}
      />

      {/* ── Source Management Sheet ── */}
      {sourceTarget && (
        <SourceManagementSheet
          competitorId={sourceTarget.id}
          competitorName={sourceTarget.name}
          open={!!sourceTarget}
          onOpenChange={(v) => { if (!v) setSourceTarget(null) }}
        />
      )}

      {/* ── Source Discovery Wizard ── */}
      {discoveryTarget && (
        <SourceDiscoveryWizard
          open={!!discoveryTarget}
          onOpenChange={(v) => { if (!v) setDiscoveryTarget(null) }}
          competitorId={discoveryTarget.id}
          competitorName={discoveryTarget.name}
          onComplete={load}
        />
      )}

      {/* ── Click-outside for sort menu ── */}
      {showFilterMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
      )}
    </div>
  )
}
