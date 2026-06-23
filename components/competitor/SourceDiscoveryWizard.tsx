'use client'

import React, { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Globe, FileText, DollarSign, BookOpen, Rss, Link2, Shield, Github,
  MessageSquare, Youtube, Star, Sparkles, Plus, Check, X, Loader2,
  ExternalLink, ChevronRight, Search, AlertCircle, CheckCircle, XCircle,
  RefreshCw, Trash2, Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiscoveredSource {
  url: string
  sourceType: string
  label: string
  priority: string
  rationale: string
  selected: boolean
  status: 'pending' | 'valid' | 'invalid' | 'added' | 'crawling' | 'crawled' | 'failed'
}

type WizardPhase = 'discovering' | 'review' | 'adding' | 'crawling' | 'done'

// ─── Icons / Colors ─────────────────────────────────────────────────────────

const SOURCE_TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  WEBSITE:       { icon: <Globe className="h-3.5 w-3.5" />,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DOCS:          { icon: <BookOpen className="h-3.5 w-3.5" />,       color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  PRICING:       { icon: <DollarSign className="h-3.5 w-3.5" />,     color: 'text-amber-600 bg-amber-50 border-amber-200' },
  BLOG:          { icon: <Rss className="h-3.5 w-3.5" />,            color: 'text-violet-600 bg-violet-50 border-violet-200' },
  RELEASE_NOTES: { icon: <FileText className="h-3.5 w-3.5" />,       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  INTEGRATIONS:  { icon: <Link2 className="h-3.5 w-3.5" />,          color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  TRUST:         { icon: <Shield className="h-3.5 w-3.5" />,         color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  GITHUB:        { icon: <Github className="h-3.5 w-3.5" />,         color: 'text-gray-600 bg-gray-50 border-gray-200' },
  REDDIT:        { icon: <MessageSquare className="h-3.5 w-3.5" />,  color: 'text-orange-600 bg-orange-50 border-orange-200' },
  YOUTUBE:       { icon: <Youtube className="h-3.5 w-3.5" />,        color: 'text-red-600 bg-red-50 border-red-200' },
  PRODUCT_HUNT:  { icon: <Star className="h-3.5 w-3.5" />,           color: 'text-orange-500 bg-orange-50 border-orange-200' },
  NEWS:          { icon: <Search className="h-3.5 w-3.5" />,         color: 'text-sky-600 bg-sky-50 border-sky-200' },
  CUSTOM:        { icon: <Globe className="h-3.5 w-3.5" />,          color: 'text-gray-500 bg-gray-50 border-gray-200' },
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  NORMAL: 'bg-gray-100 text-gray-700 border-gray-200',
  LOW: 'bg-gray-50 text-gray-500 border-gray-200',
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SourceDiscoveryWizard({
  open,
  onOpenChange,
  competitorId,
  competitorName,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitorId: string
  competitorName: string
  onComplete?: () => void
}) {
  const [phase, setPhase] = useState<WizardPhase>('discovering')
  const [sources, setSources] = useState<DiscoveredSource[]>([])
  const [manualUrl, setManualUrl] = useState('')
  const [crawlResults, setCrawlResults] = useState<{ success: number; failed: number; total: number } | null>(null)

  // ── Auto-discover on open ───────────────────────────────────────────────
  const discover = useCallback(async () => {
    setPhase('discovering')
    setSources([])

    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources/discover`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Discovery failed')
      const data = await res.json()

      const discovered: DiscoveredSource[] = (data.suggestions || []).map((s: any) => ({
        url: s.url,
        sourceType: s.sourceType || 'WEBSITE',
        label: s.label || s.url,
        priority: s.priority || 'NORMAL',
        rationale: s.rationale || '',
        selected: s.priority === 'HIGH',
        status: 'pending' as const,
      }))

      setSources(discovered)
      setPhase('review')
    } catch {
      toast.error('Source discovery failed')
      setPhase('review')
    }
  }, [competitorId])

  React.useEffect(() => {
    if (open) discover()
  }, [open, discover])

  // ── Toggle selection ────────────────────────────────────────────────────
  const toggleSource = (idx: number) => {
    setSources((prev) => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))
  }

  const selectAll = () => setSources((prev) => prev.map((s) => ({ ...s, selected: true })))
  const clearAll = () => setSources((prev) => prev.map((s) => ({ ...s, selected: false })))

  const removeSource = (idx: number) => {
    setSources((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Add manual source ──────────────────────────────────────────────────
  const addManualSource = () => {
    if (!manualUrl.trim()) return
    const url = manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`
    setSources((prev) => [
      ...prev,
      {
        url,
        sourceType: 'CUSTOM',
        label: url,
        priority: 'NORMAL',
        rationale: 'Manually added',
        selected: true,
        status: 'pending',
      },
    ])
    setManualUrl('')
  }

  // ── Save approved sources + start crawling ─────────────────────────────
  const approveAndCrawl = async () => {
    const selected = sources.filter((s) => s.selected)
    if (selected.length === 0) {
      toast.error('Select at least one source')
      return
    }

    // Phase 1: Add sources to DB
    setPhase('adding')
    const addedSourceIds: string[] = []

    for (let i = 0; i < selected.length; i++) {
      const src = selected[i]
      setSources((prev) => prev.map((s) => s.url === src.url ? { ...s, status: 'adding' as any } : s))

      try {
        const res = await fetch(`/api/competitors/${competitorId}/managed-sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: src.url,
            sourceType: src.sourceType,
            label: src.label,
            priority: src.priority,
            crawlFrequency: 'WEEKLY',
          }),
        })

        if (res.ok) {
          const data = await res.json()
          addedSourceIds.push(data.id)
          setSources((prev) => prev.map((s) => s.url === src.url ? { ...s, status: 'added' } : s))
        } else if (res.status === 409) {
          // Already exists — try to get its ID
          setSources((prev) => prev.map((s) => s.url === src.url ? { ...s, status: 'added' } : s))
        } else {
          setSources((prev) => prev.map((s) => s.url === src.url ? { ...s, status: 'invalid' } : s))
        }
      } catch {
        setSources((prev) => prev.map((s) => s.url === src.url ? { ...s, status: 'invalid' } : s))
      }
    }

    // Phase 2: Batch crawl
    setPhase('crawling')
    setSources((prev) => prev.map((s) => s.status === 'added' ? { ...s, status: 'crawling' } : s))

    try {
      const res = await fetch(`/api/competitors/${competitorId}/crawl-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addedSourceIds.length > 0 ? { sourceIds: addedSourceIds } : {}),
      })

      if (res.ok) {
        const data = await res.json()
        setCrawlResults({ success: data.success, failed: data.failed, total: data.total })

        // Update source statuses from results
        setSources((prev) => prev.map((s) => {
          const result = data.results?.find((r: any) => r.url === s.url)
          if (result) {
            return { ...s, status: result.success ? 'crawled' : 'failed' }
          }
          return s.status === 'crawling' ? { ...s, status: 'crawled' } : s
        }))
      }
    } catch {
      toast.error('Batch crawl failed')
    }

    setPhase('done')
  }

  const selectedCount = sources.filter((s) => s.selected).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Source Discovery — {competitorName}
          </DialogTitle>
          <DialogDescription>
            {phase === 'discovering' && 'Discovering relevant sources using AI...'}
            {phase === 'review' && 'Review discovered sources. Select which ones to monitor, then start crawling.'}
            {phase === 'adding' && 'Adding approved sources...'}
            {phase === 'crawling' && 'Crawling approved sources for content...'}
            {phase === 'done' && 'Source discovery and initial crawl complete.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 py-2">
          {/* Discovering spinner */}
          {phase === 'discovering' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing {competitorName} and discovering sources...</p>
            </div>
          )}

          {/* Source list */}
          {phase !== 'discovering' && (
            <>
              {/* Controls */}
              {phase === 'review' && (
                <div className="flex items-center justify-between gap-2 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">Select All</Button>
                    <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">Clear</Button>
                    <span className="text-xs text-muted-foreground">{selectedCount}/{sources.length} selected</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={discover} className="text-xs h-7 gap-1">
                    <RefreshCw className="h-3 w-3" />Re-discover
                  </Button>
                </div>
              )}

              {/* Source cards */}
              <div className="space-y-2">
                {sources.map((source, idx) => {
                  const meta = SOURCE_TYPE_META[source.sourceType] || SOURCE_TYPE_META.CUSTOM
                  const statusIcon = source.status === 'crawled' ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : source.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" />
                    : source.status === 'crawling' ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    : source.status === 'added' ? <Check className="h-4 w-4 text-emerald-500" />
                    : source.status === 'invalid' ? <AlertCircle className="h-4 w-4 text-red-500" />
                    : null

                  return (
                    <div
                      key={`${source.url}-${idx}`}
                      className={cn(
                        'border rounded-lg p-3 flex items-start gap-3 transition-colors',
                        source.selected && phase === 'review' ? 'border-primary/50 bg-primary/5' : '',
                        source.status === 'crawled' ? 'border-emerald-200 bg-emerald-50/30' : '',
                        source.status === 'failed' ? 'border-red-200 bg-red-50/30' : '',
                      )}
                    >
                      {/* Checkbox (review phase only) */}
                      {phase === 'review' && (
                        <Checkbox
                          checked={source.selected}
                          onCheckedChange={() => toggleSource(idx)}
                          className="mt-1"
                        />
                      )}

                      {/* Status icon (non-review phases) */}
                      {phase !== 'review' && statusIcon && (
                        <div className="mt-0.5 shrink-0">{statusIcon}</div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1', meta.color)}>
                            {meta.icon}
                            {source.sourceType.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', PRIORITY_BADGE[source.priority])}>
                            {source.priority}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{source.label}</p>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block mt-0.5 flex items-center gap-1"
                        >
                          {source.url}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                        {source.rationale && (
                          <p className="text-[10px] text-muted-foreground mt-1">{source.rationale}</p>
                        )}
                      </div>

                      {/* Remove button (review phase only) */}
                      {phase === 'review' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSource(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Manual source input (review phase) */}
              {phase === 'review' && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input
                    placeholder="Add a source URL manually..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManualSource()}
                    className="text-sm h-8"
                  />
                  <Button size="sm" variant="outline" onClick={addManualSource} disabled={!manualUrl.trim()} className="h-8 shrink-0 gap-1">
                    <Plus className="h-3.5 w-3.5" />Add
                  </Button>
                </div>
              )}

              {/* Done summary */}
              {phase === 'done' && crawlResults && (
                <div className="rounded-lg border p-4 bg-muted/30 text-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium">
                    Crawled {crawlResults.success} of {crawlResults.total} sources
                    {crawlResults.failed > 0 && <span className="text-red-600"> ({crawlResults.failed} failed)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sources are now being monitored. View details in the Sources tab.
                  </p>
                </div>
              )}

              {sources.length === 0 && phase === 'review' && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No sources discovered. Add sources manually below.</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          {phase === 'review' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Skip for now</Button>
              <Button onClick={approveAndCrawl} disabled={selectedCount === 0} className="gap-1.5">
                <Play className="h-4 w-4" />
                Approve & Crawl ({selectedCount})
              </Button>
            </>
          )}
          {phase === 'done' && (
            <Button onClick={() => { onOpenChange(false); onComplete?.() }}>
              Done
            </Button>
          )}
          {(phase === 'adding' || phase === 'crawling') && (
            <Button disabled className="gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === 'adding' ? 'Adding sources...' : 'Crawling...'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
