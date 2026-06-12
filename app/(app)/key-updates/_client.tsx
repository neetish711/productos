'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  RefreshCw, Loader2, Search, TrendingUp, AlertCircle, PlusCircle,
  CheckCircle, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import { timeAgo } from '@/lib/utils'

interface Competitor { id: string; name: string }
interface KeyUpdate {
  id: string
  competitorId: string
  competitor: Competitor
  updateType: string
  title: string
  description: string
  diffSummaryText: string
  detectedAt: Date
  pmActionStatus: string
  sourceUrl?: string
  significance?: string
  evidenceSnippet?: string
  changeType?: string
}

interface Props {
  updates: KeyUpdate[]
}

const ACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'To Review',
  IN_REVIEW: 'In Review',
  ACTIONED: 'Actioned',
  DISMISSED: 'Dismissed',
  NONE: 'No Action',
}

const UPDATE_TYPE_ICONS: Record<string, typeof TrendingUp> = {
  NEW_FEATURE: PlusCircle,
  ENHANCEMENT: TrendingUp,
  DEPRECATION: AlertCircle,
}

const SIGNIFICANCE_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM_HIGH: 'bg-amber-100 text-amber-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-500',
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  FEATURE_LAUNCHED: 'Feature Launched',
  FEATURE_REMOVED: 'Feature Removed',
  PRICING_CHANGED: 'Pricing Changed',
  INTEGRATION_ADDED: 'Integration Added',
  AI_MESSAGING_CHANGED: 'AI Messaging Changed',
  COMPLIANCE_CHANGED: 'Compliance Changed',
  CUSTOMER_STORY_ADDED: 'Customer Story',
  RELEASE_PUBLISHED: 'Release Published',
  DOCS_UPDATED: 'Docs Updated',
  EXEC_SIGNAL: 'Exec Signal',
}

// Map old updateType → significance
function inferSignificance(update: KeyUpdate): string {
  if (update.significance) return update.significance
  const map: Record<string, string> = {
    PRICING_CHANGE: 'HIGH',
    DEPRECATION: 'HIGH',
    NEW_FEATURE: 'MEDIUM_HIGH',
    ENHANCEMENT: 'MEDIUM',
    PARTNERSHIP: 'LOW',
  }
  return map[update.updateType] ?? 'MEDIUM'
}

export function KeyUpdatesClient({ updates: initial }: Props) {
  const router = useRouter()
  const [updates, setUpdates] = useState(initial)
  const [running, setRunning] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCompetitor, setFilterCompetitor] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterChangeType, setFilterChangeType] = useState('all')
  const [highSigOnly, setHighSigOnly] = useState(false)
  const [expandedWhyIds, setExpandedWhyIds] = useState<Set<string>>(new Set())

  const competitors = Array.from(new Map(initial.map((u) => [u.competitorId, u.competitor])).values())

  const changeTypes = Array.from(new Set(updates.map((u) => u.changeType).filter(Boolean) as string[]))

  const filtered = updates.filter((u) => {
    const sig = inferSignificance(u)
    const matchSearch = !search ||
      u.title.toLowerCase().includes(search.toLowerCase()) ||
      (u.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      u.diffSummaryText.toLowerCase().includes(search.toLowerCase())
    const matchComp = filterCompetitor === 'all' || u.competitorId === filterCompetitor
    const matchStatus = filterStatus === 'all' || u.pmActionStatus === filterStatus
    const matchChangeType = filterChangeType === 'all' || u.changeType === filterChangeType
    const matchSig = !highSigOnly || sig === 'HIGH' || sig === 'MEDIUM_HIGH'
    return matchSearch && matchComp && matchStatus && matchChangeType && matchSig
  })

  const pendingCount = updates.filter((u) => u.pmActionStatus === 'PENDING' || u.pmActionStatus === 'NONE').length

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch('/api/key-updates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pmActionStatus: status }),
    })
    if (res.ok) {
      setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, pmActionStatus: status } : u)))
      toast.success('Status updated')
    } else {
      toast.error('Failed to update status')
    }
  }

  const runRefresh = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/cron/competitor-refresh', { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Competitor refresh started')
      router.refresh()
    } catch {
      toast.error('Failed to start refresh')
    } finally {
      setRunning(false)
    }
  }

  function toggleWhyMatters(id: string) {
    setExpandedWhyIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Key Updates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Latest competitor changes detected by the 15-day refresh cycle
            {pendingCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {pendingCount} to review</span>}
          </p>
        </div>
        <Button onClick={runRefresh} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run 15-Day Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search updates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterCompetitor} onValueChange={setFilterCompetitor}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All competitors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All competitors</SelectItem>
            {competitors.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(ACTION_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {changeTypes.length > 0 && (
          <Select value={filterChangeType} onValueChange={setFilterChangeType}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All change types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All change types</SelectItem>
              {changeTypes.map((ct) => (
                <SelectItem key={ct} value={ct}>{CHANGE_TYPE_LABELS[ct] ?? ct}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Switch id="high-sig" checked={highSigOnly} onCheckedChange={setHighSigOnly} />
          <Label htmlFor="high-sig" className="text-sm cursor-pointer">High significance only</Label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
          <h3 className="font-semibold text-lg">No updates found</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {updates.length === 0 ? 'Run a competitor refresh to detect changes' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((update) => {
            const Icon = UPDATE_TYPE_ICONS[update.updateType] ?? TrendingUp
            const sig = inferSignificance(update)
            const sigStyle = SIGNIFICANCE_STYLES[sig] ?? SIGNIFICANCE_STYLES.MEDIUM
            const sigLabel = sig.replace('_', '-')
            const whyExpanded = expandedWhyIds.has(update.id)
            const whyText = update.description?.trim() || update.diffSummaryText
            const changeTypeLabel = update.changeType ? (CHANGE_TYPE_LABELS[update.changeType] ?? update.changeType) : null

            return (
              <div key={update.id} className="flex gap-4 p-4 rounded-lg border hover:bg-accent/30 transition-colors">
                <div className="shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{update.title}</span>
                        <Badge variant="outline" className="text-xs">{update.competitor.name}</Badge>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sigStyle}`}>
                          {sigLabel} significance
                        </span>
                        {changeTypeLabel && (
                          <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">{changeTypeLabel}</span>
                        )}
                      </div>

                      {/* Why it matters */}
                      {whyText && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleWhyMatters(update.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {whyExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            Why this matters
                          </button>
                          {whyExpanded && (
                            <p className="text-sm text-muted-foreground mt-1.5 pl-4 border-l-2 border-muted">
                              {whyText}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Evidence snippet */}
                      {update.evidenceSnippet && (
                        <blockquote className="mt-2 pl-3 border-l-2 border-muted text-xs text-muted-foreground italic">
                          &ldquo;{update.evidenceSnippet}&rdquo;
                        </blockquote>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-muted-foreground">
                          Detected {timeAgo(update.detectedAt)}
                        </p>
                        {update.sourceUrl && (
                          <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />Source
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 shrink-0 flex-col sm:flex-row">
                      <Select
                        value={update.pmActionStatus}
                        onValueChange={(v) => updateStatus(update.id, v)}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACTION_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
