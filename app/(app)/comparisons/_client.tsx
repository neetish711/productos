'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Search, X, ChevronDown, Sparkles, Loader2,
  Layers, SlidersHorizontal, GitCompare,
  CheckCircle2, XCircle, AlertCircle, Equal, Minus,
  Zap, ArrowLeftRight, HelpCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OurFeature {
  id: string; name: string; category: string; description: string
}

interface Competitor {
  id: string; name: string
}

interface CompetitorFeature {
  id: string; competitorId: string; name: string; category: string; description: string
  competitor: Competitor
}

interface Comparison {
  id: string; ourFeatureId: string; competitorId: string; positioning: string
  similaritiesText: string; differencesText: string
  enhancementOpportunitiesText: string; keyTakeawaysText: string
}

interface Props {
  ourFeatures: OurFeature[]
  competitors: Competitor[]
  competitorFeatures: CompetitorFeature[]
  comparisons: Comparison[]
}

type Standing = 'AHEAD' | 'BEHIND' | 'EQUIVALENT' | 'PARTIAL' | 'UNIQUE' | 'ADJACENT' | 'NO_OVERLAP' | 'NEEDS_REVIEW'
type OverlapStrength = 'strong' | 'moderate' | 'weak' | 'minimal' | 'none'

interface OverlappingFeature {
  featureName: string; ownerSide: string; overlapStrength: OverlapStrength; notes: string
}

interface FeatureAnalysis {
  featureId: string; featureName: string; featureCategory: string; featureDescription: string
  ownerSide: string; competitiveStanding: Standing; overlapStrength: OverlapStrength
  overlappingFeatures: OverlappingFeature[]; scenarioSummary: string; reasoning: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STANDING: Record<Standing, { label: string; badge: string; border: string; icon: React.ElementType }> = {
  AHEAD:        { label: 'Ahead',        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-l-emerald-500', icon: CheckCircle2 },
  BEHIND:       { label: 'Behind',       badge: 'bg-red-100 text-red-700 border-red-200',             border: 'border-l-red-500',     icon: XCircle },
  EQUIVALENT:   { label: 'Equivalent',   badge: 'bg-blue-100 text-blue-700 border-blue-200',          border: 'border-l-blue-500',    icon: Equal },
  PARTIAL:      { label: 'Partial',      badge: 'bg-amber-100 text-amber-700 border-amber-200',       border: 'border-l-amber-500',   icon: AlertCircle },
  UNIQUE:       { label: 'Unique',       badge: 'bg-violet-100 text-violet-700 border-violet-200',    border: 'border-l-violet-500',  icon: Zap },
  ADJACENT:     { label: 'Adjacent',     badge: 'bg-sky-100 text-sky-700 border-sky-200',             border: 'border-l-sky-400',     icon: ArrowLeftRight },
  NO_OVERLAP:   { label: 'No Overlap',   badge: 'bg-gray-100 text-gray-600 border-gray-200',          border: 'border-l-gray-300',    icon: Minus },
  NEEDS_REVIEW: { label: 'Needs Review', badge: 'bg-orange-100 text-orange-700 border-orange-200',    border: 'border-l-orange-400',  icon: HelpCircle },
}

const OVERLAP_DOT: Record<OverlapStrength, string> = {
  strong: 'bg-emerald-400', moderate: 'bg-amber-400', weak: 'bg-orange-400', minimal: 'bg-gray-400', none: 'bg-gray-300',
}

const OVERLAP_PILL: Record<OverlapStrength, string> = {
  strong:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  weak:     'bg-orange-50 text-orange-700 border-orange-200',
  minimal:  'bg-gray-50 text-gray-600 border-gray-200',
  none:     'bg-gray-50 text-gray-400 border-gray-200',
}

type Density = 'compact' | 'default' | 'comfortable'

const D: Record<Density, { row: string; name: string; sub: string }> = {
  compact:     { row: 'py-1 px-3',   name: 'text-xs',             sub: 'text-[10px]' },
  default:     { row: 'py-2 px-4',   name: 'text-sm',             sub: 'text-xs' },
  comfortable: { row: 'py-3.5 px-4', name: 'text-sm font-medium', sub: 'text-xs' },
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ComparisonsClient({ ourFeatures, competitors, competitorFeatures, comparisons: initial }: Props) {
  const [comparisons]                       = useState<Comparison[]>(initial)
  const [selectedOurIds, setSelectedOurIds] = useState<Set<string>>(new Set())
  const [selectedCfIds,  setSelectedCfIds]  = useState<Set<string>>(new Set())
  const [analyses,       setAnalyses]       = useState<FeatureAnalysis[]>([])
  const [generating,     setGenerating]     = useState(false)
  const [hasResults,     setHasResults]     = useState(false)
  const [builderOpen,    setBuilderOpen]    = useState(true)

  // Layout
  const [splitPercent, setSplitPercent] = useState(50)
  const [listHeight,   setListHeight]   = useState(320)
  const [density,      setDensity]      = useState<Density>('default')

  // Drag/resize refs (avoid re-renders during drag)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const isResizing   = useRef(false)
  const startResizeY = useRef(0)
  const startHeight  = useRef(0)

  // Builder filters
  const [ourSearch,    setOurSearch]    = useState('')
  const [ourCat,       setOurCat]       = useState('all')
  const [cfSearch,     setCfSearch]     = useState('')
  const [cfCompFilter, setCfCompFilter] = useState('all')

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   comparisons.length,
    ahead:   comparisons.filter(c => c.positioning === 'AHEAD').length,
    behind:  comparisons.filter(c => c.positioning === 'BEHIND').length,
    partial: comparisons.filter(c => c.positioning === 'PARTIAL').length,
  }), [comparisons])

  // ── Derived data ──────────────────────────────────────────────────────────
  const ourCategories = useMemo(() =>
    Array.from(new Set(ourFeatures.map(f => f.category))).sort(),
    [ourFeatures])

  const filteredOurFeatures = useMemo(() => {
    let list = ourFeatures
    if (ourCat !== 'all') list = list.filter(f => f.category === ourCat)
    if (ourSearch) {
      const q = ourSearch.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
    }
    return list
  }, [ourFeatures, ourCat, ourSearch])

  const competitorGroups = useMemo(() => {
    const groups: Record<string, { competitor: Competitor; features: CompetitorFeature[] }> = {}
    for (const cf of competitorFeatures) {
      if (cfCompFilter !== 'all' && cf.competitorId !== cfCompFilter) continue
      if (cfSearch) {
        const q = cfSearch.toLowerCase()
        if (!cf.name.toLowerCase().includes(q) && !cf.category.toLowerCase().includes(q)) continue
      }
      if (!groups[cf.competitorId]) groups[cf.competitorId] = { competitor: cf.competitor, features: [] }
      groups[cf.competitorId].features.push(cf)
    }
    return Object.values(groups)
  }, [competitorFeatures, cfSearch, cfCompFilter])

  const selectedCompetitorIds = useMemo(() => {
    const ids = new Set<string>()
    Array.from(selectedCfIds).forEach(cfId => {
      const cf = competitorFeatures.find(f => f.id === cfId)
      if (cf) ids.add(cf.competitorId)
    })
    return ids
  }, [selectedCfIds, competitorFeatures])

  const canBuild      = selectedOurIds.size + selectedCfIds.size > 0
  const totalSelected = selectedOurIds.size + selectedCfIds.size

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleOur = useCallback((id: string) => {
    setSelectedOurIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const toggleCf = useCallback((id: string) => {
    setSelectedCfIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  const selectAllOur = () => setSelectedOurIds(new Set(filteredOurFeatures.map(f => f.id)))
  const clearOur     = () => setSelectedOurIds(new Set())
  const clearAllCf   = () => setSelectedCfIds(new Set())

  const selectAllForComp = (compId: string) => {
    const ids = competitorFeatures.filter(cf => cf.competitorId === compId).map(cf => cf.id)
    setSelectedCfIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
  }
  const clearForComp = (compId: string) => {
    const ids = competitorFeatures.filter(cf => cf.competitorId === compId).map(cf => cf.id)
    setSelectedCfIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
  }

  // ── Draggable divider ──────────────────────────────────────────────────────
  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct  = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPercent(Math.min(75, Math.max(25, pct)))
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Height resize handle ──────────────────────────────────────────────────
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current  = true
    startResizeY.current = e.clientY
    startHeight.current  = listHeight

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = ev.clientY - startResizeY.current
      setListHeight(Math.min(600, Math.max(160, startHeight.current + delta)))
    }
    const onUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Build (feature-centric analysis) ─────────────────────────────────────
  const handleBuild = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/comparisons/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ourFeatureIds:        Array.from(selectedOurIds),
          competitorFeatureIds: Array.from(selectedCfIds),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Analysis failed')
      const data = await res.json()
      const list = Array.isArray(data.analyses) ? data.analyses : []
      setAnalyses(list)
      setHasResults(true)
      setBuilderOpen(false)
      toast.success(`${list.length} feature${list.length !== 1 ? 's' : ''} analyzed`)
    } catch (e: any) {
      toast.error(e.message ?? 'Analysis failed — check LLM config')
    } finally {
      setGenerating(false)
    }
  }

  const dc = D[density]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-auto bg-background">

      {/* ── Header + Stats ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b px-6 py-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Feature Comparisons</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select features from either side, then build a focused overlap analysis
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Saved Comparisons', value: stats.total,   cls: 'text-foreground' },
            { label: 'Ahead',             value: stats.ahead,   cls: 'text-emerald-600' },
            { label: 'Behind',            value: stats.behind,  cls: 'text-red-600' },
            { label: 'Partial',           value: stats.partial, cls: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-0.5', s.cls)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-6 space-y-4">

        {/* ── Builder ───────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">

          {/* Collapsible header */}
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors border-b text-left"
            onClick={() => setBuilderOpen(v => !v)}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Comparison Builder</span>
              {(selectedOurIds.size > 0 || selectedCfIds.size > 0) && (
                <div className="flex items-center gap-1.5">
                  {selectedOurIds.size > 0 && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {selectedOurIds.size} our {selectedOurIds.size === 1 ? 'feature' : 'features'}
                    </span>
                  )}
                  {selectedCfIds.size > 0 && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {selectedCfIds.size} competitor {selectedCfIds.size === 1 ? 'feature' : 'features'}
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', !builderOpen && '-rotate-90')} />
          </button>

          {builderOpen && (
            <>
              {/* ── Control bar — Build CTA above panels ── */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/10">
                {/* LEFT: density toggle */}
                <div className="flex items-center gap-0.5 rounded-lg border p-0.5 bg-background">
                  {(['compact', 'default', 'comfortable'] as Density[]).map(mode => (
                    <button key={mode} onClick={() => setDensity(mode)}
                      className={cn(
                        'px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize',
                        density === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}>
                      {mode === 'compact' ? 'Compact' : mode === 'default' ? 'Default' : 'Comfortable'}
                    </button>
                  ))}
                </div>
                {/* RIGHT: selection summary + Build CTA */}
                <div className="flex items-center gap-3">
                  {totalSelected > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {totalSelected} feature{totalSelected !== 1 ? 's' : ''} selected
                    </span>
                  )}
                  <Button onClick={handleBuild} disabled={!canBuild || generating} size="sm" className="gap-2">
                    {generating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing…</>
                      : <><Sparkles className="h-3.5 w-3.5" />Build Comparison</>
                    }
                  </Button>
                </div>
              </div>

              {/* ── Split panels ── */}
              <div ref={containerRef} className="flex" style={{ userSelect: 'none' }}>

                {/* LEFT — Our Features */}
                <div className="flex flex-col overflow-hidden border-r" style={{ width: `${splitPercent}%` }}>
                  <div className="px-4 pt-3 pb-2.5 border-b space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Our Features</p>
                      <div className="flex items-center gap-3">
                        <button onClick={selectAllOur} className="text-xs text-primary hover:underline underline-offset-2">
                          Select all
                        </button>
                        {selectedOurIds.size > 0 && (
                          <button onClick={clearOur} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                            <X className="h-3 w-3" />Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input value={ourSearch} onChange={e => setOurSearch(e.target.value)}
                          placeholder="Search features…" className="pl-8 h-8 text-sm" />
                      </div>
                      <Select value={ourCat} onValueChange={setOurCat}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SlidersHorizontal className="h-3 w-3 mr-1.5 shrink-0" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {ourCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="overflow-y-auto overflow-x-hidden" style={{ height: listHeight }}>
                    {filteredOurFeatures.length === 0
                      ? <EmptySearch />
                      : (
                        <div className="divide-y">
                          {filteredOurFeatures.map(f => (
                            <label key={f.id}
                              className={cn('flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors', dc.row, selectedOurIds.has(f.id) && 'bg-primary/5')}
                            >
                              <Checkbox checked={selectedOurIds.has(f.id)} onCheckedChange={() => toggleOur(f.id)} className="mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className={cn('font-medium leading-snug', dc.name)}>{f.name}</p>
                                <p className={cn('text-muted-foreground mt-0.5', dc.sub)}>{f.category}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )
                    }
                  </div>

                  {selectedOurIds.size > 0 && (
                    <div className="px-4 py-1.5 border-t bg-muted/10 text-xs font-medium text-muted-foreground">
                      {selectedOurIds.size} selected
                    </div>
                  )}
                </div>

                {/* ◀ Draggable divider ▶ */}
                <div
                  onMouseDown={onDividerMouseDown}
                  className="w-1.5 shrink-0 bg-border hover:bg-primary/30 cursor-col-resize transition-colors flex items-center justify-center"
                  title="Drag to resize"
                >
                  <div className="w-0.5 h-8 rounded-full bg-muted-foreground/25" />
                </div>

                {/* RIGHT — Competitor Features */}
                <div className="flex flex-col overflow-hidden flex-1">
                  <div className="px-4 pt-3 pb-2.5 border-b space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Competitor Features</p>
                      {selectedCfIds.size > 0 && (
                        <button onClick={clearAllCf} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                          <X className="h-3 w-3" />Clear all
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input value={cfSearch} onChange={e => setCfSearch(e.target.value)}
                          placeholder="Search features…" className="pl-8 h-8 text-sm" />
                      </div>
                      <Select value={cfCompFilter} onValueChange={setCfCompFilter}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SlidersHorizontal className="h-3 w-3 mr-1.5 shrink-0" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All competitors</SelectItem>
                          {competitors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="overflow-y-auto overflow-x-hidden" style={{ height: listHeight }}>
                    {competitorGroups.length === 0 ? (
                      competitorFeatures.length === 0
                        ? (
                          <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center text-muted-foreground">
                            <GitCompare className="h-6 w-6 mb-2 opacity-30" />
                            <p className="text-sm font-medium">No competitor features yet</p>
                            <p className="text-xs mt-1">Add features to competitors in the Competitors section</p>
                          </div>
                        )
                        : <EmptySearch />
                    ) : (
                      competitorGroups.map(({ competitor, features }) => {
                        const allSel = features.every(f => selectedCfIds.has(f.id))
                        return (
                          <div key={competitor.id}>
                            <div className="flex items-center justify-between px-4 py-1.5 bg-muted/25 border-y first:border-t-0 sticky top-0 z-10">
                              <span className="text-xs font-semibold">{competitor.name}</span>
                              <button
                                onClick={() => allSel ? clearForComp(competitor.id) : selectAllForComp(competitor.id)}
                                className="text-xs text-primary hover:underline underline-offset-2"
                              >
                                {allSel ? 'Deselect all' : 'Select all'}
                              </button>
                            </div>
                            <div className="divide-y">
                              {features.map(cf => (
                                <label key={cf.id}
                                  className={cn('flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors', dc.row, selectedCfIds.has(cf.id) && 'bg-primary/5')}
                                >
                                  <Checkbox checked={selectedCfIds.has(cf.id)} onCheckedChange={() => toggleCf(cf.id)} className="mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className={cn('font-medium leading-snug', dc.name)}>{cf.name}</p>
                                    <p className={cn('text-muted-foreground mt-0.5', dc.sub)}>{cf.category}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {selectedCfIds.size > 0 && (
                    <div className="px-4 py-1.5 border-t bg-muted/10 text-xs font-medium text-muted-foreground">
                      {selectedCfIds.size} selected across {selectedCompetitorIds.size} {selectedCompetitorIds.size === 1 ? 'competitor' : 'competitors'}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Height resize handle ── */}
              <div
                onMouseDown={onResizeMouseDown}
                className="h-3 border-t bg-muted/20 hover:bg-primary/10 cursor-row-resize flex items-center justify-center transition-colors"
                title="Drag to resize panel height"
              >
                <div className="w-12 h-0.5 rounded-full bg-muted-foreground/25" />
              </div>
            </>
          )}
        </div>

        {/* ── Results ───────────────────────────────────────────────────── */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {analyses.length} Analysis{analyses.length !== 1 ? 'es' : ''}
              </h2>
              <Button variant="outline" size="sm" onClick={() => { setBuilderOpen(true) }}>
                Modify Selection
              </Button>
            </div>

            {analyses.map((analysis, idx) => {
              const cfg  = STANDING[analysis.competitiveStanding] ?? STANDING.NEEDS_REVIEW
              const Icon = cfg.icon
              const isOurs = analysis.ownerSide === 'ours'
              const strength = (analysis.overlapStrength ?? 'none') as OverlapStrength

              return (
                <div key={analysis.featureId ?? idx} className={cn('rounded-xl border bg-card shadow-sm overflow-hidden border-l-4', cfg.border)}>

                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold">{analysis.featureName}</span>
                      {analysis.featureCategory && (
                        <span className="text-xs text-muted-foreground">{analysis.featureCategory}</span>
                      )}
                      <Badge variant="outline" className={cn('text-[10px] border shrink-0', isOurs ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted/50')}>
                        {isOurs ? 'Our product' : analysis.ownerSide}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn('gap-1.5 border', cfg.badge)}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border', OVERLAP_PILL[strength])}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', OVERLAP_DOT[strength])} />
                        {strength} overlap
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-4">

                    {/* Overlapping features chips */}
                    {analysis.overlappingFeatures?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                          Overlapping Features
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.overlappingFeatures.map((of, i) => (
                            <span key={i} title={of.notes}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium cursor-default"
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', OVERLAP_DOT[(of.overlapStrength ?? 'none') as OverlapStrength])} />
                              {of.featureName}
                              <span className="text-muted-foreground font-normal text-[10px]">
                                · {of.ownerSide === 'ours' ? 'us' : of.ownerSide}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scenario summary + reasoning */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {analysis.scenarioSummary && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                            Competitive Landscape
                          </p>
                          <p className="text-sm leading-relaxed">{analysis.scenarioSummary}</p>
                        </div>
                      )}
                      {analysis.reasoning && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                            Reasoning
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">{analysis.reasoning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pre-build empty state ────────────────────────────────────── */}
        {!hasResults && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="rounded-full bg-muted/50 p-4 mb-4">
              <GitCompare className="h-7 w-7 opacity-40" />
            </div>
            <p className="text-sm font-medium mb-1">Ready to analyze</p>
            <p className="text-xs max-w-[300px] leading-relaxed">
              Select features from our product or competitors above — then click{' '}
              <span className="font-medium text-foreground">Build Comparison</span> to run an AI-powered overlap analysis
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function EmptySearch() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
      <Search className="h-5 w-5 mb-2 opacity-30" />
      <p className="text-sm">No features match your search</p>
    </div>
  )
}
