'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { WorkflowCanvas as WorkflowCanvasComponent } from '@/components/competitor/WorkflowCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  ExternalLink, ChevronLeft, AlertCircle, BookOpen, TrendingUp,
  Lightbulb, Shield, Database, BarChart3, Zap, RefreshCw, Copy,
  CheckCircle, Circle, MinusCircle, XCircle, Wifi, WifiOff, Clock,
  FileText, Globe, Link as LinkIcon, PlusCircle, Target,
  ChevronDown, ChevronRight, Download, Settings, Trash2,
  Activity, GitBranch, Layers, Search, Star, MessageSquare,
  Play, Pause, TriangleAlert, Info, ArrowRight, ScanSearch,
  FlaskConical, Cpu, Sparkles, ClipboardList,
} from 'lucide-react'
import { timeAgo, formatDate, cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import { CrawlSetupModal } from '@/components/competitor/CrawlSetupModal'
import { SourceManagementSheet } from '@/components/competitor/SourceManagementSheet'
import { CreateRoadmapItemDialog } from '@/components/competitor/CreateRoadmapItemDialog'
import { CompetitorSourceManager } from '@/components/competitor/CompetitorSourceManager'
import { CompetitorReportViewer } from '@/components/competitor/CompetitorReportViewer'
import { ReportGenerationModal } from '@/components/competitor/ReportGenerationModal'

// ─── Types ───────────────────────────────────────────────────────────────────

type SourceEvidence = {
  id: string; url: string; title: string; snippet: string
  sourceType: string; confidence: number; dateAccessed: Date
}

type Feature = {
  id: string; name: string; description: string; category: string
  matchStatus: string; roadmapImplicationText: string
  prosText: string; consText: string; marketSentimentText: string
  enrichmentStatus: string; matchConfidence: number
  sourceEvidence: SourceEvidence[]; updatedAt: Date; createdAt: Date
}

type KeyUpdate = {
  id: string; updateType: string; title: string
  diffSummaryText: string; pmActionStatus: string
  detectedAt: Date; description: string; sourceUrl: string
}

type BattleCard = {
  id: string; title: string; strengthsText: string; weaknessesText: string
  differentiatorsText: string; salesMessagingText: string
  pmTakeawaysText: string; contentMd: string
}

type ManagedSource = {
  id: string; url: string; domain: string | null; sourceType: string
  label: string | null; status: string; priority: string
  crawlFrequency: string; crawlDepth: number
  includePaths: string | null; excludePaths: string | null
  notes: string | null; isActive: boolean; isAutoDiscovered: boolean
  lastCrawledAt: string | null; lastSuccessAt: string | null
  lastChangeAt: string | null; freshnessScore: number | null
  evidenceScore: number | null; crawlHealthStatus: string | null
  createdAt: string
}

type Report = {
  id: string; title: string; status: string
  confidenceOverall: number | null; evidenceCount: number; sourceCount: number
  generatedAt: Date | null; modelUsed: string | null
  executiveSummary: string | null; createdAt: Date
}

type Competitor = {
  id: string; name: string; website: string; description: string
  monitoringEnabled: boolean; lastRefreshAt: Date | null
  refreshFrequencyDays?: number
  reportStatus?: string; lastReportAt?: Date | null
  features: Feature[]; keyUpdates: KeyUpdate[]; battleCards: BattleCard[]
  managedSources?: ManagedSource[]
  reports?: Report[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MATCH_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  BEHIND:             { label: "They're ahead",    color: 'bg-red-50 text-red-700 border-red-200',        icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> },
  PARTIAL:            { label: 'Partial overlap',  color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <MinusCircle className="h-3.5 w-3.5 text-amber-500" /> },
  AHEAD:              { label: "We're ahead",      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> },
  DIFFERENT_APPROACH: { label: 'Different approach', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: <Circle className="h-3.5 w-3.5 text-violet-500" /> },
  NO_MATCH:           { label: 'Gap / no match',   color: 'bg-gray-50 text-gray-600 border-gray-200',     icon: <Circle className="h-3.5 w-3.5 text-gray-400" /> },
}

const UPDATE_TYPE_COLORS: Record<string, string> = {
  NEW_FEATURE:    'bg-blue-50 text-blue-700 border-blue-200',
  ENHANCEMENT:    'bg-violet-50 text-violet-700 border-violet-200',
  PRICING_CHANGE: 'bg-amber-50 text-amber-700 border-amber-200',
  DEPRECATION:    'bg-red-50 text-red-700 border-red-200',
  PARTNERSHIP:    'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const UPDATE_TYPE_LABELS: Record<string, string> = {
  NEW_FEATURE: 'New Feature', ENHANCEMENT: 'Enhancement',
  PRICING_CHANGE: 'Pricing Change', DEPRECATION: 'Deprecated', PARTNERSHIP: 'Partnership',
}

const PM_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'To Review', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  IN_REVIEW: { label: 'In Review', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ACTIONED:  { label: 'Actioned', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DISMISSED: { label: 'Dismissed', color: 'bg-gray-50 text-gray-500 border-gray-200' },
  NONE:      { label: 'No Action', color: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'AI':           <Zap className="h-3.5 w-3.5" />,
  'Analytics':    <BarChart3 className="h-3.5 w-3.5" />,
  'Automation':   <RefreshCw className="h-3.5 w-3.5" />,
  'Self-Service': <BookOpen className="h-3.5 w-3.5" />,
  'Productivity': <Target className="h-3.5 w-3.5" />,
  'Integrations': <LinkIcon className="h-3.5 w-3.5" />,
  'Channels':     <Globe className="h-3.5 w-3.5" />,
  'Engagement':   <PlusCircle className="h-3.5 w-3.5" />,
  'Enterprise':   <Shield className="h-3.5 w-3.5" />,
}

const SIGNIFICANCE: Record<string, { label: string; color: string }> = {
  High:         { label: 'High', color: 'bg-red-50 text-red-700 border-red-200' },
  'Medium-High':{ label: 'Medium-High', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  Medium:       { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  Low:          { label: 'Low', color: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const LLM_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSignificance(updateType: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    PRICING_CHANGE: SIGNIFICANCE.High,
    DEPRECATION:    SIGNIFICANCE.High,
    NEW_FEATURE:    SIGNIFICANCE['Medium-High'],
    ENHANCEMENT:    SIGNIFICANCE.Medium,
    PARTNERSHIP:    SIGNIFICANCE.Low,
  }
  return map[updateType] ?? SIGNIFICANCE.Medium
}

function getWhyItMatters(update: KeyUpdate): string {
  if (update.description?.trim()) return update.description
  const fallbacks: Record<string, string> = {
    PRICING_CHANGE: 'Pricing changes directly affect competitive positioning and may create displacement or retention risk.',
    DEPRECATION:    'Deprecated capabilities may signal a strategic pivot worth monitoring for impact on shared customers.',
    NEW_FEATURE:    'New features can shift buyer expectations and create gaps in our own feature narrative.',
    ENHANCEMENT:    'Product improvements narrow existing gaps and may change how prospects evaluate alternatives.',
    PARTNERSHIP:    'Partnerships can expand their distribution reach and integrations ecosystem.',
  }
  return fallbacks[update.updateType] ?? ''
}

function renderBullets(text: string) {
  if (!text) return null
  return (
    <ul className="space-y-1">
      {text.split('\n').filter(Boolean).map((line, i) => (
        <li key={i} className="text-sm flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-60" />
          <span>{line.replace(/^[•\-]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  )
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>{pct}%</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CompetitorDetailClient({ competitor }: { competitor: Competitor }) {
  const router = useRouter()

  // Feature sheet
  const [activeFeature, setActiveFeature] = React.useState<Feature | null>(null)
  const [roadmapDialogOpen, setRoadmapDialogOpen] = React.useState(false)

  // Updates filters
  const [updateFilter, setUpdateFilter] = React.useState<string>('ALL')
  const [highSigOnly, setHighSigOnly] = React.useState(false)

  // Features collapsible categories
  const [collapsedCategories, setCollapsedCategories] = React.useState<Set<string>>(new Set())

  // Crawl
  const [crawlOpen, setCrawlOpen] = React.useState(false)

  // Source management sheet
  const [sourcesSheetOpen, setSourcesSheetOpen] = React.useState(false)

  // Report generation modal
  const [reportGenerateOpen, setReportGenerateOpen] = React.useState(false)

  // Settings state
  const [settingsMonitoring, setSettingsMonitoring] = React.useState(competitor.monitoringEnabled)
  const [settingsFrequency, setSettingsFrequency] = React.useState(String(competitor.refreshFrequencyDays ?? 15))
  const [settingsLlm, setSettingsLlm] = React.useState('claude-sonnet-4-6')
  const [settingsTabVisited, setSettingsTabVisited] = React.useState(false)
  const [settingsSaving, setSettingsSaving] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  React.useEffect(() => {
    const saved = localStorage.getItem('crawl_llm_preference')
    if (saved) setSettingsLlm(saved)
  }, [])

  const categories = Array.from(new Set(competitor.features.map((f) => f.category).filter(Boolean)))
  const featuresByCategory = categories.map((cat) => ({
    category: cat,
    features: competitor.features.filter((f) => f.category === cat),
  }))

  const allSources = competitor.features.flatMap((f) =>
    f.sourceEvidence.map((s) => ({ ...s, featureName: f.name }))
  )

  const pendingUpdates = competitor.keyUpdates.filter(
    (u) => u.pmActionStatus === 'PENDING' || u.pmActionStatus === 'IN_REVIEW'
  )

  const filteredUpdates = React.useMemo(() => {
    let list = updateFilter === 'ALL'
      ? competitor.keyUpdates
      : competitor.keyUpdates.filter((u) => u.updateType === updateFilter)
    if (highSigOnly) {
      list = list.filter((u) => {
        const sig = getSignificance(u.updateType)
        return sig.label === 'High' || sig.label === 'Medium-High'
      })
    }
    return list
  }, [competitor.keyUpdates, updateFilter, highSigOnly])

  const battleCard = competitor.battleCards[0] ?? null

  const monitoringStatus = !competitor.monitoringEnabled
    ? { label: 'Monitoring paused', icon: <WifiOff className="h-3.5 w-3.5" />, color: 'text-muted-foreground' }
    : !competitor.lastRefreshAt
    ? { label: 'Not yet crawled', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-amber-600' }
    : { label: `Last crawled ${timeAgo(competitor.lastRefreshAt)}`, icon: <Wifi className="h-3.5 w-3.5" />, color: 'text-emerald-600' }

  const behindCount = competitor.features.filter((f) => f.matchStatus === 'BEHIND').length
  const aheadCount = competitor.features.filter((f) => f.matchStatus === 'AHEAD').length

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  async function saveSettings(patch: Record<string, unknown>) {
    setSettingsSaving(true)
    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast.success('Settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSettingsSaving(false) }
  }

  async function deleteCompetitor() {
    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Competitor deleted')
      router.push('/competitors')
    } catch { toast.error('Failed to delete') }
  }

  // Battlecard export handlers
  function copyAsMarkdown() {
    navigator.clipboard.writeText(battleCard?.contentMd ?? '')
    toast.success('Copied as Markdown')
  }

  function copyForSlack() {
    if (!battleCard) return
    const parts: string[] = []
    if (battleCard.strengthsText) parts.push(`🔴 *Their Strengths*\n${battleCard.strengthsText.split('\n').filter(Boolean).map((l) => `• ${l.replace(/^[•\-]\s*/, '')}`).join('\n')}`)
    if (battleCard.weaknessesText) parts.push(`🟢 *Their Weaknesses*\n${battleCard.weaknessesText.split('\n').filter(Boolean).map((l) => `• ${l.replace(/^[•\-]\s*/, '')}`).join('\n')}`)
    if (battleCard.differentiatorsText) parts.push(`🔵 *How We Win*\n${battleCard.differentiatorsText.split('\n').filter(Boolean).map((l) => `• ${l.replace(/^[•\-]\s*/, '')}`).join('\n')}`)
    if (battleCard.pmTakeawaysText) parts.push(`🟡 *PM Takeaways*\n${battleCard.pmTakeawaysText.split('\n').filter(Boolean).map((l) => `• ${l.replace(/^[•\-]\s*/, '')}`).join('\n')}`)
    navigator.clipboard.writeText(parts.join('\n\n'))
    toast.success('Copied for Slack')
  }

  function downloadMd() {
    if (!battleCard) return
    const blob = new Blob([battleCard.contentMd ?? ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `battlecard-${competitor.name.toLowerCase().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copySection(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 shrink-0">
        <Link href="/competitors" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-3.5 w-3.5" />All Competitors
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {competitor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{competitor.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {competitor.website && (
                  <a href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    {competitor.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className={`inline-flex items-center gap-1 text-xs ${monitoringStatus.color}`}>
                  {monitoringStatus.icon}{monitoringStatus.label}
                </span>
              </div>
              {competitor.description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{competitor.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setCrawlOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Re-crawl
            </Button>
            <Button size="sm" onClick={() => setReportGenerateOpen(true)}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />Generate Report
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <div className="border-b px-6 shrink-0">
            <TabsList className="h-auto bg-transparent p-0 gap-0">
              {[
                { value: 'overview', label: 'Overview' },
                { value: 'features', label: `Features (${competitor.features.length})` },
                { value: 'updates', label: `Updates (${competitor.keyUpdates.length})`, badge: pendingUpdates.length },
                { value: 'sources', label: `Sources (${(competitor.managedSources ?? []).length})` },
                { value: 'workflow', label: 'Workflow' },
                { value: 'coverage', label: 'Coverage' },
                { value: 'reports', label: 'Reports' },
                { value: 'battlecard', label: 'Battlecard', disabled: !battleCard },
                { value: 'settings', label: 'Settings' },
                { value: 'messaging', label: 'Messaging', soon: true },
                { value: 'pricing', label: 'Pricing', soon: true },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  disabled={'disabled' in t && !!t.disabled}
                  onFocus={() => { if (t.value === 'settings' && !settingsTabVisited) setSettingsTabVisited(true) }}
                  onClick={() => { if (t.value === 'settings' && !settingsTabVisited) setSettingsTabVisited(true) }}
                  className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  {t.label}
                  {'badge' in t && t.badge && t.badge > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-semibold">
                      {t.badge}
                    </span>
                  ) : null}
                  {'soon' in t && t.soon ? (
                    <span className="ml-1.5 text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">soon</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="p-6 space-y-6 mt-0">

              {/* Intelligence Health Bar */}
              {(() => {
                const sources = competitor.managedSources ?? []
                const reports = competitor.reports ?? []
                const featuresWithEvidence = competitor.features.filter((f) => f.sourceEvidence.length > 0).length
                const sections = {
                  description: !!competitor.description?.trim(),
                  features: competitor.features.length > 0,
                  sources: sources.length > 0,
                  updates: competitor.keyUpdates.length > 0,
                  report: reports.length > 0 && reports[0]?.status === 'READY',
                }
                const completeness = Math.round(Object.values(sections).filter(Boolean).length / Object.keys(sections).length * 100)
                const featuresWithConf = competitor.features.filter((f) => (f as any).matchConfidence > 0)
                const avgConf = featuresWithConf.length > 0
                  ? Math.round(featuresWithConf.reduce((s, f) => s + (f as any).matchConfidence, 0) / featuresWithConf.length * 100)
                  : 0
                const failing = sources.filter((s) => s.status === 'FAILED' || s.status === 'BLOCKED').length
                const latestReport = reports[0]

                return (
                  <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intelligence Health</p>
                      {latestReport && (
                        <span className="text-xs text-muted-foreground">
                          Report: <span className={latestReport.status === 'READY' ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{latestReport.status.replace(/_/g, ' ')}</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completeness</span>
                          <span className="font-semibold">{completeness}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${completeness}%` }} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Confidence</p>
                        <p className={`text-lg font-bold ${avgConf >= 75 ? 'text-emerald-600' : avgConf >= 50 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {avgConf > 0 ? `${avgConf}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Evidence-backed</p>
                        <p className="text-lg font-bold">{featuresWithEvidence}<span className="text-xs font-normal text-muted-foreground">/{competitor.features.length}</span></p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Source health</p>
                        <p className={`text-lg font-bold ${failing > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {failing > 0 ? `${failing} failing` : `${sources.filter((s) => s.isActive).length} active`}
                        </p>
                      </div>
                    </div>
                    {/* Section coverage */}
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(sections).map(([key, ok]) => (
                        <span key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {ok ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Features', value: competitor.features.length, sub: 'tracked' },
                  { label: 'Categories', value: categories.length, sub: 'areas' },
                  { label: 'Updates', value: competitor.keyUpdates.length, sub: 'recorded' },
                  { label: 'Sources', value: allSources.length, sub: 'evidence' },
                  { label: 'Gaps', value: behindCount, sub: 'where behind', highlight: behindCount > 0 },
                  { label: 'Wins', value: aheadCount, sub: 'where ahead', positive: aheadCount > 0 },
                ].map((kpi) => (
                  <div key={kpi.label} className={`border rounded-lg p-3 text-center ${kpi.highlight ? 'border-red-200 bg-red-50/50' : kpi.positive ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                    <p className={`text-2xl font-bold ${kpi.highlight ? 'text-red-700' : kpi.positive ? 'text-emerald-700' : ''}`}>{kpi.value}</p>
                    <p className="text-xs font-medium mt-0.5">{kpi.label}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Feature Coverage by Category</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {featuresByCategory.map(({ category, features }) => {
                    const behind = features.filter((f) => f.matchStatus === 'BEHIND').length
                    const ahead = features.filter((f) => f.matchStatus === 'AHEAD').length
                    return (
                      <div key={category} className="border rounded-lg p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          {CATEGORY_ICONS[category] ?? <Database className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{category}</p>
                          <p className="text-xs text-muted-foreground">{features.length} feature{features.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {behind > 0 && <span className="text-xs text-red-600 font-medium">−{behind}</span>}
                          {ahead > 0 && <span className="text-xs text-emerald-600 font-medium">+{ahead}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {competitor.keyUpdates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
                  <div className="space-y-2">
                    {competitor.keyUpdates.slice(0, 3).map((u) => (
                      <div key={u.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${UPDATE_TYPE_COLORS[u.updateType] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {UPDATE_TYPE_LABELS[u.updateType] ?? u.updateType}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{u.title}</p>
                          {u.diffSummaryText && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{u.diffSummaryText}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(u.detectedAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {battleCard?.contentMd && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Strategic Summary</h3>
                  <div className="border rounded-lg p-4 bg-muted/30 prose prose-sm max-w-none">
                    {battleCard.contentMd.split('\n').filter(Boolean).map((line, i) => {
                      if (line.startsWith('## ')) return <h4 key={i} className="text-sm font-semibold mt-3 mb-1 first:mt-0">{line.replace('## ', '')}</h4>
                      if (line.startsWith('### ')) return <h5 key={i} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1">{line.replace('### ', '')}</h5>
                      return <p key={i} className="text-sm text-muted-foreground">{line}</p>
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Features Tab ── */}
            <TabsContent value="features" className="p-6 mt-0">
              {competitor.features.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                  <p className="font-medium">No features tracked yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Collapse all / Expand all */}
                  <div className="flex items-center justify-end mb-4">
                    <button
                      onClick={() => setCollapsedCategories(
                        collapsedCategories.size === 0 ? new Set(categories) : new Set()
                      )}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {collapsedCategories.size === 0 ? 'Collapse all' : 'Expand all'}
                    </button>
                  </div>

                  <div className="space-y-6">
                    {featuresByCategory.map(({ category, features }) => {
                      const isCollapsed = collapsedCategories.has(category)
                      const categoryBehind = features.filter((f) => f.matchStatus === 'BEHIND').length
                      const categoryAhead = features.filter((f) => f.matchStatus === 'AHEAD').length
                      return (
                        <div key={category}>
                          {/* Category header — clickable */}
                          <div
                            className="flex items-center justify-between cursor-pointer group mb-3"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-muted-foreground">
                                {CATEGORY_ICONS[category] ?? <Database className="h-3 w-3" />}
                              </div>
                              <h3 className="text-sm font-semibold">{category}</h3>
                              <span className="text-xs text-muted-foreground">{features.length} feature{features.length !== 1 ? 's' : ''}</span>
                              {categoryBehind > 0 && <span className="text-xs text-red-600 font-medium">{categoryBehind} behind</span>}
                              {categoryAhead > 0 && <span className="text-xs text-emerald-600 font-medium">{categoryAhead} ahead</span>}
                            </div>
                            {isCollapsed
                              ? <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                            }
                          </div>

                          {/* Feature grid */}
                          {!isCollapsed && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                              {features.map((f) => {
                                const ms = MATCH_STATUS[f.matchStatus] ?? MATCH_STATUS.NO_MATCH
                                return (
                                  <button
                                    key={f.id}
                                    onClick={() => setActiveFeature(f)}
                                    className="text-left border rounded-lg p-4 hover:bg-muted/40 hover:border-primary/30 transition-all group"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">{f.name}</p>
                                      <span className={`text-xs border rounded px-1.5 py-0.5 font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${ms.color}`}>
                                        {ms.icon}{ms.label}
                                      </span>
                                    </div>
                                    {f.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{f.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                      {f.sourceEvidence.length > 0 && (
                                        <span className="text-xs text-muted-foreground">{f.sourceEvidence.length} source{f.sourceEvidence.length !== 1 ? 's' : ''}</span>
                                      )}
                                      {f.roadmapImplicationText && (
                                        <span className="text-xs text-amber-600 flex items-center gap-1">
                                          <Lightbulb className="h-3 w-3" />roadmap signal
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        View details →
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Updates Tab ── */}
            <TabsContent value="updates" className="p-6 mt-0">
              {/* Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {['ALL', 'NEW_FEATURE', 'ENHANCEMENT', 'PRICING_CHANGE', 'DEPRECATION', 'PARTNERSHIP'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setUpdateFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      updateFilter === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted border-transparent'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : UPDATE_TYPE_LABELS[f] ?? f}
                    {f !== 'ALL' && (
                      <span className="ml-1 opacity-60">
                        {competitor.keyUpdates.filter((u) => u.updateType === f).length}
                      </span>
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <Label htmlFor="high-sig-toggle" className="text-xs text-muted-foreground cursor-pointer">High significance only</Label>
                  <Switch
                    id="high-sig-toggle"
                    checked={highSigOnly}
                    onCheckedChange={setHighSigOnly}
                    className="scale-75"
                  />
                </div>
              </div>

              {filteredUpdates.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
                  <p className="font-medium">No updates match the current filter</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUpdates.map((u) => {
                    const pmCfg = PM_STATUS[u.pmActionStatus] ?? PM_STATUS.NONE
                    const sig = getSignificance(u.updateType)
                    const whyItMatters = getWhyItMatters(u)
                    return (
                      <div key={u.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className={`text-xs border rounded px-2 py-0.5 font-medium ${UPDATE_TYPE_COLORS[u.updateType] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {UPDATE_TYPE_LABELS[u.updateType] ?? u.updateType}
                              </span>
                              <span className={`text-xs border rounded px-2 py-0.5 font-medium ${sig.color}`}>
                                {sig.label} significance
                              </span>
                              <span className="text-xs text-muted-foreground">{formatDate(u.detectedAt)}</span>
                            </div>
                            <p className="font-semibold text-sm">{u.title}</p>
                            {u.diffSummaryText && (
                              <p className="text-sm text-muted-foreground mt-1">{u.diffSummaryText}</p>
                            )}
                            {whyItMatters && (
                              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                                <p className="text-xs font-semibold text-amber-700 mb-1">Why this matters</p>
                                <p className="text-xs text-amber-800">{whyItMatters}</p>
                              </div>
                            )}
                            {u.sourceUrl && (
                              <a href={u.sourceUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                                <ExternalLink className="h-3 w-3" />Source
                              </a>
                            )}
                          </div>
                          <span className={`text-xs border rounded px-2 py-0.5 font-medium shrink-0 ${pmCfg.color}`}>
                            {pmCfg.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Sources Tab ── */}
            <TabsContent value="sources" className="p-6 mt-0">
              <CompetitorSourceManager
                competitorId={competitor.id}
                initialSources={competitor.managedSources ?? []}
              />
            </TabsContent>

            {/* ── Workflow Tab ── */}
            <TabsContent value="workflow" className="p-6 mt-0">
              <WorkflowTab competitor={competitor} />
            </TabsContent>

            {/* ── Coverage Tab ── */}
            <TabsContent value="coverage" className="p-6 mt-0">
              <CoverageTab competitor={competitor} />
            </TabsContent>

            {/* ── Reports Tab ── */}
            <TabsContent value="reports" className="p-6 mt-0">
              <CompetitorReportViewer
                competitorId={competitor.id}
                competitorName={competitor.name}
              />
            </TabsContent>

            {/* ── Battlecard Tab ── */}
            <TabsContent value="battlecard" className="p-6 mt-0">
              {!battleCard ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground/30" />
                  <p className="font-medium">No battlecard generated yet</p>
                  <Button variant="outline" size="sm" onClick={() => toast.info('Battlecard generation coming soon')}>
                    Generate Battlecard
                  </Button>
                </div>
              ) : (
                <div className="max-w-3xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{battleCard.title}</h2>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download className="h-3.5 w-3.5 mr-1.5" />Export
                          <ChevronDown className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={copyAsMarkdown}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Copy as Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyForSlack}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Copy for Slack
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={downloadMd}>
                          <Download className="h-3.5 w-3.5 mr-2" />Download .md
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {battleCard.strengthsText && (
                      <div className="border rounded-lg p-4 border-red-200 bg-red-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Their Strengths</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copySection(battleCard.strengthsText, 'Their Strengths')}>
                            <Copy className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                        <div className="text-red-800">{renderBullets(battleCard.strengthsText)}</div>
                      </div>
                    )}
                    {battleCard.weaknessesText && (
                      <div className="border rounded-lg p-4 border-emerald-200 bg-emerald-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Their Weaknesses</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copySection(battleCard.weaknessesText, 'Their Weaknesses')}>
                            <Copy className="h-3 w-3 text-emerald-400" />
                          </Button>
                        </div>
                        <div className="text-emerald-800">{renderBullets(battleCard.weaknessesText)}</div>
                      </div>
                    )}
                    {battleCard.differentiatorsText && (
                      <div className="border rounded-lg p-4 border-blue-200 bg-blue-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">How We Win</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copySection(battleCard.differentiatorsText, 'How We Win')}>
                            <Copy className="h-3 w-3 text-blue-400" />
                          </Button>
                        </div>
                        <div className="text-blue-800">{renderBullets(battleCard.differentiatorsText)}</div>
                      </div>
                    )}
                    {battleCard.pmTakeawaysText && (
                      <div className="border rounded-lg p-4 border-violet-200 bg-violet-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">PM Takeaways</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copySection(battleCard.pmTakeawaysText, 'PM Takeaways')}>
                            <Copy className="h-3 w-3 text-violet-400" />
                          </Button>
                        </div>
                        <div className="text-violet-800">{renderBullets(battleCard.pmTakeawaysText)}</div>
                      </div>
                    )}
                  </div>

                  {battleCard.salesMessagingText && (
                    <div className="border rounded-lg p-4 bg-amber-50/40 border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Sales Messaging</p>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copySection(battleCard.salesMessagingText, 'Sales Messaging')}>
                          <Copy className="h-3 w-3 text-amber-400" />
                        </Button>
                      </div>
                      <p className="text-sm text-amber-800">{battleCard.salesMessagingText}</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Settings Tab ── */}
            <TabsContent value="settings" className="p-6 mt-0">
              <div className="max-w-lg space-y-6">
                {/* Monitoring */}
                <div className="border rounded-lg p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable monitoring</p>
                      <p className="text-xs text-muted-foreground">Automatically re-crawl this competitor on a schedule</p>
                    </div>
                    <Switch
                      checked={settingsMonitoring}
                      disabled={settingsSaving}
                      onCheckedChange={(v) => {
                        setSettingsMonitoring(v)
                        saveSettings({ monitoringEnabled: v })
                      }}
                    />
                  </div>
                </div>

                {/* Refresh frequency */}
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Refresh frequency</p>
                  <p className="text-xs text-muted-foreground">How often to re-crawl this competitor</p>
                  <Select
                    value={settingsFrequency}
                    onValueChange={(v) => {
                      setSettingsFrequency(v)
                      saveSettings({ refreshFrequencyDays: Number(v) })
                    }}
                  >
                    <SelectTrigger className="w-48 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Every 7 days</SelectItem>
                      <SelectItem value="15">Every 15 days</SelectItem>
                      <SelectItem value="30">Every 30 days</SelectItem>
                      <SelectItem value="60">Every 60 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* LLM preference */}
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">LLM model preference</p>
                  <p className="text-xs text-muted-foreground">Used when manually triggering re-crawls</p>
                  <Select
                    value={settingsLlm}
                    onValueChange={(v) => {
                      setSettingsLlm(v)
                      localStorage.setItem('crawl_llm_preference', v)
                      toast.success('LLM preference saved')
                    }}
                  >
                    <SelectTrigger className="w-64 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Crawl history */}
                <div className="border rounded-lg p-4 space-y-1">
                  <p className="text-sm font-medium">Crawl history</p>
                  <p className="text-xs text-muted-foreground">
                    Last crawled: {competitor.lastRefreshAt ? timeAgo(competitor.lastRefreshAt) : 'Never'}
                  </p>
                </div>

                {/* Danger zone */}
                <div className="border border-destructive/30 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-destructive">Danger zone</p>
                  <p className="text-xs text-muted-foreground">Permanently delete this competitor and all associated data. This cannot be undone.</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Competitor
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Messaging (Coming Soon) ── */}
            <TabsContent value="messaging" className="p-6 mt-0">
              <ComingSoonTab
                icon={<TrendingUp className="h-10 w-10 text-muted-foreground/30" />}
                title="Messaging & Positioning"
                description="Track how this competitor describes their product, what personas they target, and how their messaging evolves over time."
                items={['Key messaging themes', 'Target personas', 'Recurring proof points', 'Message drift detection']}
              />
            </TabsContent>

            {/* ── Pricing (Coming Soon) ── */}
            <TabsContent value="pricing" className="p-6 mt-0">
              <ComingSoonTab
                icon={<BarChart3 className="h-10 w-10 text-muted-foreground/30" />}
                title="Pricing & Packaging"
                description="Track pricing pages, plan structure, feature gating, and pricing changes over time."
                items={['Plan structure', 'Feature gating', 'Price change history', 'SMB vs enterprise signals']}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* ── Feature Detail Sheet ── */}
      <Sheet open={!!activeFeature} onOpenChange={() => setActiveFeature(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {activeFeature && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="text-base">{activeFeature.name}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="secondary" className="text-xs">{activeFeature.category}</Badge>
                  {(() => {
                    const ms = MATCH_STATUS[activeFeature.matchStatus] ?? MATCH_STATUS.NO_MATCH
                    return (
                      <span className={`text-xs border rounded px-2 py-0.5 font-medium inline-flex items-center gap-1 ${ms.color}`}>
                        {ms.icon}{ms.label}
                      </span>
                    )
                  })()}
                  {/* Feature status badge */}
                  {(() => {
                    const statusMap: Record<string, string> = {
                      VALIDATED: 'bg-emerald-100 text-emerald-700',
                      EXTRACTED: 'bg-blue-100 text-blue-700',
                      LOW_CONFIDENCE: 'bg-amber-100 text-amber-700',
                      NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
                      STALE: 'bg-gray-100 text-gray-600',
                    }
                    const status = (activeFeature as any).status ?? 'EXTRACTED'
                    const color = statusMap[status] ?? statusMap.EXTRACTED
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    )
                  })()}
                  {activeFeature.sourceEvidence.length > 0 && (
                    <span className="text-xs text-muted-foreground">{activeFeature.sourceEvidence.length} source{activeFeature.sourceEvidence.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </SheetHeader>

              <div className="py-5 space-y-5">
                {activeFeature.description && (
                  <Section label="What it does">
                    <p className="text-sm text-foreground">{activeFeature.description}</p>
                  </Section>
                )}

                {activeFeature.roadmapImplicationText && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" />Roadmap Signal
                    </p>
                    <p className="text-sm text-amber-800">{activeFeature.roadmapImplicationText}</p>
                  </div>
                )}

                {activeFeature.marketSentimentText && (
                  <Section label="How they position it">
                    <p className="text-sm text-muted-foreground">{activeFeature.marketSentimentText}</p>
                  </Section>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {activeFeature.prosText && (
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1.5">Their Strengths</p>
                      <div className="text-emerald-800">{renderBullets(activeFeature.prosText)}</div>
                    </div>
                  )}
                  {activeFeature.consText && (
                    <div className="border border-red-200 bg-red-50/40 rounded-lg p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-1.5">Their Weaknesses</p>
                      <div className="text-red-800">{renderBullets(activeFeature.consText)}</div>
                    </div>
                  )}
                </div>

                {/* Counter-positioning for Sales */}
                {activeFeature.consText && (
                  <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1.5 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />How to Counter (Sales)
                    </p>
                    <p className="text-xs text-blue-800">
                      Use their weaknesses above as objection handles. When prospects raise this feature,
                      acknowledge it, then redirect to our differentiation and their documented limitations.
                    </p>
                  </div>
                )}

                {/* Source Evidence Chain */}
                {activeFeature.sourceEvidence.length > 0 && (() => {
                  const OFFICIAL_TYPES = new Set(['official', 'website', 'docs', 'pricing', 'release_notes'])
                  const THIRD_PARTY_TYPES = new Set(['news', 'analyst', 'review', 'blog'])
                  const official = activeFeature.sourceEvidence.filter((s) => OFFICIAL_TYPES.has(s.sourceType.toLowerCase()))
                  const thirdParty = activeFeature.sourceEvidence.filter((s) => THIRD_PARTY_TYPES.has(s.sourceType.toLowerCase()))
                  const community = activeFeature.sourceEvidence.filter((s) =>
                    !OFFICIAL_TYPES.has(s.sourceType.toLowerCase()) && !THIRD_PARTY_TYPES.has(s.sourceType.toLowerCase())
                  )
                  const confidenceLabel = official.length >= 2
                    ? `High confidence — ${official.length} official sources`
                    : official.length === 1
                    ? 'Moderate confidence — 1 official source'
                    : 'Low confidence — community sources only'
                  const confidenceColor = official.length >= 2 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : official.length === 1 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-600 bg-gray-50 border-gray-200'

                  return (
                    <Section label={`Evidence Chain (${activeFeature.sourceEvidence.length} source${activeFeature.sourceEvidence.length !== 1 ? 's' : ''})`}>
                      <div className={`inline-flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 mb-3 font-medium ${confidenceColor}`}>
                        <ScanSearch className="h-3 w-3" />{confidenceLabel}
                      </div>
                      {[
                        { label: 'Official Sources', sources: official, color: 'text-emerald-700 bg-emerald-100', badge: 'Most trustworthy' },
                        { label: 'Third-Party', sources: thirdParty, color: 'text-blue-700 bg-blue-100', badge: 'Independent' },
                        { label: 'Community', sources: community, color: 'text-amber-700 bg-amber-100', badge: 'Anecdotal' },
                      ].filter((g) => g.sources.length > 0).map((group) => (
                        <div key={group.label} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <p className={`text-xs font-medium px-2 py-0.5 rounded-full ${group.color}`}>{group.label}</p>
                            <span className="text-[10px] text-muted-foreground">{group.badge}</span>
                          </div>
                          <div className="space-y-2 pl-1 border-l-2 border-muted ml-2">
                            {group.sources.map((s) => (
                              <div key={s.id} className="border rounded-lg p-3 ml-3 bg-card">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {s.sourceType.replace('_', ' ')}
                                  </span>
                                  <ConfidencePill value={s.confidence} />
                                  {s.dateAccessed && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(s.dateAccessed)}</span>
                                  )}
                                </div>
                                {s.title && <p className="text-xs font-medium line-clamp-1 mb-1">{s.title}</p>}
                                {s.snippet && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5 italic border-l-2 border-muted pl-2">
                                    &ldquo;{s.snippet}&rdquo;
                                  </p>
                                )}
                                <a href={s.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate max-w-[220px]">{s.url.replace(/^https?:\/\//, '')}</span>
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </Section>
                  )
                })()}

                <div className="border-t pt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRoadmapDialogOpen(true)}
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" />Create Roadmap Item
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.info('Battlecard linking coming soon')}>
                    <Shield className="h-3.5 w-3.5 mr-1.5" />Add to Battlecard
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Last updated {timeAgo(activeFeature.updatedAt)}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Crawl Modal */}
      <CrawlSetupModal
        open={crawlOpen}
        onOpenChange={setCrawlOpen}
        competitorNames={[competitor.name]}
        initialSources={competitor.website ? [{ url: competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}` }] : []}
      />

      {/* Source Management Sheet */}
      <SourceManagementSheet
        competitorId={competitor.id}
        competitorName={competitor.name}
        open={sourcesSheetOpen}
        onOpenChange={setSourcesSheetOpen}
      />

      {/* Report Generation Modal (from header button) */}
      <ReportGenerationModal
        open={reportGenerateOpen}
        onOpenChange={setReportGenerateOpen}
        competitorId={competitor.id}
        competitorName={competitor.name}
        onComplete={() => setReportGenerateOpen(false)}
      />

      {/* Create Roadmap Item Dialog */}
      {activeFeature && (
        <CreateRoadmapItemDialog
          feature={activeFeature}
          competitorName={competitor.name}
          open={roadmapDialogOpen}
          onOpenChange={setRoadmapDialogOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {competitor.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all features, updates, sources, and battle cards associated with this competitor. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCompetitor}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function ComingSoonTab({ icon, title, description, items }: {
  icon: React.ReactNode; title: string; description: string; items: string[]
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 max-w-md mx-auto gap-4">
      {icon}
      <div>
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
        {items.map((item) => (
          <div key={item} className="border rounded-lg px-3 py-2 text-xs text-muted-foreground bg-muted/30">
            {item}
          </div>
        ))}
      </div>
      <Badge variant="secondary" className="text-xs mt-1">Coming soon</Badge>
    </div>
  )
}

// ─── Workflow Tab ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES: Array<{
  id: string
  label: string
  icon: React.ReactNode
  color: string
  nodes: Array<{ id: string; label: string; description: string; type: string }>
}> = [
  {
    id: 'collect',
    label: 'Source Collection',
    icon: <Search className="h-4 w-4" />,
    color: 'border-blue-200 bg-blue-50/50',
    nodes: [
      { id: 'web', label: 'Web Crawler', description: 'Crawls website pages and landing pages', type: 'source' },
      { id: 'docs', label: 'Docs Crawler', description: 'Indexes documentation and help pages', type: 'source' },
      { id: 'blog', label: 'Blog / Changelog', description: 'Collects blog posts and release notes', type: 'source' },
      { id: 'reviews', label: 'Reviews Collector', description: 'G2, Capterra, and trust site reviews', type: 'source' },
      { id: 'jobs', label: 'Job Postings', description: 'Hiring signals and tech stack clues', type: 'source' },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    icon: <Layers className="h-4 w-4" />,
    color: 'border-violet-200 bg-violet-50/50',
    nodes: [
      { id: 'dedup', label: 'Deduplication', description: 'Remove duplicate content across sources', type: 'transform' },
      { id: 'normalize', label: 'Content Normalizer', description: 'Strip HTML, normalize encoding', type: 'transform' },
      { id: 'screenshot', label: 'Screenshot Extractor', description: 'Capture full-page screenshots', type: 'transform' },
      { id: 'ocr', label: 'OCR / Vision', description: 'Extract text from screenshots', type: 'transform' },
    ],
  },
  {
    id: 'extract',
    label: 'Extraction',
    icon: <ScanSearch className="h-4 w-4" />,
    color: 'border-amber-200 bg-amber-50/50',
    nodes: [
      { id: 'features', label: 'Feature Extractor', description: 'Identifies product capabilities', type: 'extract' },
      { id: 'pricing', label: 'Pricing Extractor', description: 'Extracts plans, tiers, and prices', type: 'extract' },
      { id: 'positioning', label: 'Positioning Analyzer', description: 'Extracts messaging and value props', type: 'extract' },
      { id: 'updates', label: 'Update Classifier', description: 'Classifies changes and new launches', type: 'extract' },
    ],
  },
  {
    id: 'score',
    label: 'Scoring',
    icon: <FlaskConical className="h-4 w-4" />,
    color: 'border-emerald-200 bg-emerald-50/50',
    nodes: [
      { id: 'evidence', label: 'Evidence Scorer', description: 'Rates each extraction by source quality', type: 'score' },
      { id: 'confidence', label: 'Confidence Scorer', description: 'Aggregates evidence into confidence', type: 'score' },
      { id: 'conflict', label: 'Conflict Detector', description: 'Flags contradictions between sources', type: 'score' },
    ],
  },
  {
    id: 'synthesize',
    label: 'Synthesis',
    icon: <Cpu className="h-4 w-4" />,
    color: 'border-indigo-200 bg-indigo-50/50',
    nodes: [
      { id: 'summarize', label: 'Company Summarizer', description: 'Generates company overview', type: 'synthesize' },
      { id: 'consolidate', label: 'Feature Consolidator', description: 'Merges duplicate feature extractions', type: 'synthesize' },
      { id: 'compare', label: 'Competitive Comparison', description: 'Your product vs this competitor', type: 'synthesize' },
      { id: 'final', label: 'Final Synthesis', description: 'Full intelligence package assembly', type: 'synthesize' },
    ],
  },
  {
    id: 'output',
    label: 'Output',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'border-rose-200 bg-rose-50/50',
    nodes: [
      { id: 'battlecard', label: 'Battlecard Generator', description: 'Sales-ready battlecard', type: 'output' },
      { id: 'report', label: 'Report Generator', description: 'Intelligence report document', type: 'output' },
      { id: 'alerts', label: 'Alert Dispatcher', description: 'Slack / email notifications', type: 'output' },
    ],
  },
]

function getNodeStatus(
  stageId: string,
  nodeId: string,
  competitor: Competitor
): { status: 'success' | 'warning' | 'idle' | 'error'; detail: string } {
  const sources = competitor.managedSources ?? []
  const features = competitor.features
  const reports = competitor.reports ?? []

  if (stageId === 'collect') {
    if (nodeId === 'web') {
      const webSrc = sources.find((s) => s.sourceType === 'WEBSITE')
      if (!webSrc) return { status: 'idle', detail: 'No web source configured' }
      if (webSrc.status === 'FAILED') return { status: 'error', detail: 'Last crawl failed' }
      if (webSrc.lastSuccessAt) return { status: 'success', detail: `Last crawled ${timeAgo(new Date(webSrc.lastSuccessAt))}` }
      return { status: 'warning', detail: 'Not yet crawled' }
    }
    if (nodeId === 'docs') {
      const s = sources.find((s) => s.sourceType === 'DOCS')
      if (!s) return { status: 'idle', detail: 'No docs source' }
      return s.status === 'FAILED' ? { status: 'error', detail: 'Failed' } : { status: 'success', detail: 'Active' }
    }
    if (nodeId === 'blog') {
      const s = sources.find((s) => s.sourceType === 'BLOG' || s.sourceType === 'RELEASE_NOTES')
      if (!s) return { status: 'idle', detail: 'Not configured' }
      return { status: 'success', detail: 'Active' }
    }
    if (nodeId === 'reviews') {
      return { status: 'idle', detail: 'Not configured' }
    }
    if (nodeId === 'jobs') {
      return { status: 'idle', detail: 'Not configured' }
    }
  }

  if (stageId === 'extract') {
    if (nodeId === 'features') {
      if (features.length === 0) return { status: 'idle', detail: 'No features extracted yet' }
      const evidenceBacked = features.filter((f) => f.sourceEvidence.length > 0).length
      return { status: 'success', detail: `${features.length} features (${evidenceBacked} evidence-backed)` }
    }
  }

  if (stageId === 'output') {
    if (nodeId === 'report') {
      const r = reports[0]
      if (!r) return { status: 'idle', detail: 'No report generated' }
      if (r.status === 'READY') return { status: 'success', detail: `Confidence ${Math.round((r.confidenceOverall ?? 0) * 100)}%` }
      if (r.status === 'FAILED') return { status: 'error', detail: 'Report generation failed' }
      return { status: 'warning', detail: r.status }
    }
    if (nodeId === 'battlecard') {
      const bc = competitor.battleCards[0]
      return bc ? { status: 'success', detail: 'Battlecard ready' } : { status: 'idle', detail: 'Not generated' }
    }
  }

  return { status: 'idle', detail: 'Not yet run' }
}

const STATUS_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
  error: 'bg-red-500',
  idle: 'bg-muted-foreground/30',
}

const STATUS_BADGE: Record<string, string> = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  error: 'text-red-700 bg-red-50 border-red-200',
  idle: 'text-muted-foreground bg-muted border-muted',
}

function WorkflowTab({ competitor }: { competitor: Competitor }) {
  return <WorkflowCanvasComponent competitorId={competitor.id} competitorName={competitor.name} />
}

function WorkflowTabOld({ competitor }: { competitor: Competitor }) {
  const [expandedStage, setExpandedStage] = React.useState<string | null>('collect')
  const sources = competitor.managedSources ?? []
  const lastCrawl = competitor.lastRefreshAt

  return (
    <div className="max-w-4xl space-y-4">
      {/* Pipeline header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Intelligence Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastCrawl ? `Last run ${timeAgo(lastCrawl)}` : 'Pipeline has not run yet'} · {sources.filter((s) => s.isActive).length} active sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Activity className="h-3.5 w-3.5 mr-1.5" />View Logs
          </Button>
          <Button size="sm">
            <Play className="h-3.5 w-3.5 mr-1.5" />Run Pipeline
          </Button>
        </div>
      </div>

      {/* Pipeline flow — stages as cards with arrow connectors */}
      <div className="space-y-2">
        {PIPELINE_STAGES.map((stage, si) => {
          const isExpanded = expandedStage === stage.id
          const nodeStatuses = stage.nodes.map((n) => getNodeStatus(stage.id, n.id, competitor))
          const errorCount = nodeStatuses.filter((s) => s.status === 'error').length
          const successCount = nodeStatuses.filter((s) => s.status === 'success').length
          const stageStatus = errorCount > 0 ? 'error' : successCount > 0 ? 'success' : 'idle'

          return (
            <div key={stage.id}>
              {/* Stage card */}
              <div className={`border rounded-xl overflow-hidden ${stage.color}`}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 transition-colors"
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                >
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${stage.color} border`}>
                    {stage.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        <span className="text-muted-foreground text-xs mr-1">{si + 1}.</span>
                        {stage.label}
                      </p>
                      <span className={`text-[10px] border rounded px-1.5 py-0.5 font-medium ${STATUS_BADGE[stageStatus]}`}>
                        {stageStatus === 'success' ? `${successCount}/${stage.nodes.length} active` : stageStatus === 'error' ? `${errorCount} errors` : 'Not configured'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{stage.nodes.length} nodes</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded nodes */}
                {isExpanded && (
                  <div className="border-t bg-background px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stage.nodes.map((node) => {
                      const ns = getNodeStatus(stage.id, node.id, competitor)
                      return (
                        <div key={node.id} className="border rounded-lg p-3 flex items-start gap-2.5 bg-card">
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[ns.status]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">{node.label}</p>
                            <p className="text-xs text-muted-foreground">{node.description}</p>
                            <p className={`text-[10px] mt-1 ${ns.status === 'error' ? 'text-red-600' : ns.status === 'success' ? 'text-emerald-600' : ns.status === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                              {ns.detail}
                            </p>
                          </div>
                          {ns.status === 'error' && <TriangleAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                          {ns.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Arrow connector between stages */}
              {si < PIPELINE_STAGES.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 rotate-90" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* LLM assignment overview */}
      <div className="border rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Model Assignment</p>
          <Link href="/llm-config" className="ml-auto text-xs text-primary hover:underline">Configure models →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { op: 'Extraction', model: 'Configured in LLM Settings', icon: <ScanSearch className="h-3 w-3" /> },
            { op: 'Summarization', model: 'Configured in LLM Settings', icon: <FileText className="h-3 w-3" /> },
            { op: 'Classification', model: 'Configured in LLM Settings', icon: <Layers className="h-3 w-3" /> },
            { op: 'Comparison', model: 'Configured in LLM Settings', icon: <GitBranch className="h-3 w-3" /> },
            { op: 'Report Gen.', model: 'Configured in LLM Settings', icon: <ClipboardList className="h-3 w-3" /> },
            { op: 'Battlecard', model: 'Configured in LLM Settings', icon: <Shield className="h-3 w-3" /> },
          ].map((item) => (
            <div key={item.op} className="border rounded-lg p-2.5 bg-muted/30">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-muted-foreground">{item.icon}</span>
                <p className="text-xs font-medium">{item.op}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{item.model}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Coverage Tab ─────────────────────────────────────────────────────────────

const SOURCE_TYPE_DISPLAY: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  WEBSITE:       { label: 'Website',       icon: <Globe className="h-3.5 w-3.5" />,        color: 'text-blue-600 bg-blue-50 border-blue-200' },
  DOCS:          { label: 'Docs',          icon: <BookOpen className="h-3.5 w-3.5" />,      color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  BLOG:          { label: 'Blog',          icon: <FileText className="h-3.5 w-3.5" />,      color: 'text-violet-600 bg-violet-50 border-violet-200' },
  PRICING:       { label: 'Pricing',       icon: <BarChart3 className="h-3.5 w-3.5" />,     color: 'text-amber-600 bg-amber-50 border-amber-200' },
  RELEASE_NOTES: { label: 'Changelog',     icon: <Activity className="h-3.5 w-3.5" />,      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  REDDIT:        { label: 'Reddit',        icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  GITHUB:        { label: 'GitHub',        icon: <GitBranch className="h-3.5 w-3.5" />,     color: 'text-gray-600 bg-gray-50 border-gray-200' },
  TRUST:         { label: 'Reviews',       icon: <Star className="h-3.5 w-3.5" />,          color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  INTEGRATIONS:  { label: 'Integrations',  icon: <LinkIcon className="h-3.5 w-3.5" />,      color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  YOUTUBE:       { label: 'YouTube',       icon: <Play className="h-3.5 w-3.5" />,          color: 'text-red-600 bg-red-50 border-red-200' },
}

const KEY_SECTIONS = [
  { key: 'description', label: 'Description', icon: <Info className="h-4 w-4" />, check: (c: Competitor) => !!c.description?.trim() },
  { key: 'features', label: 'Features', icon: <Layers className="h-4 w-4" />, check: (c: Competitor) => c.features.length > 0, detail: (c: Competitor) => `${c.features.length} tracked` },
  { key: 'sources', label: 'Sources', icon: <Database className="h-4 w-4" />, check: (c: Competitor) => (c.managedSources ?? []).length > 0, detail: (c: Competitor) => `${(c.managedSources ?? []).length} configured` },
  { key: 'updates', label: 'Key Updates', icon: <Activity className="h-4 w-4" />, check: (c: Competitor) => c.keyUpdates.length > 0, detail: (c: Competitor) => `${c.keyUpdates.length} detected` },
  { key: 'evidence', label: 'Evidence', icon: <ScanSearch className="h-4 w-4" />, check: (c: Competitor) => c.features.some((f) => f.sourceEvidence.length > 0), detail: (c: Competitor) => `${c.features.filter((f) => f.sourceEvidence.length > 0).length} features sourced` },
  { key: 'report', label: 'Report', icon: <FileText className="h-4 w-4" />, check: (c: Competitor) => (c.reports ?? []).some((r) => r.status === 'READY'), detail: (c: Competitor) => (c.reports ?? []).length > 0 ? `${(c.reports ?? [])[0].status}` : 'Not generated' },
  { key: 'battlecard', label: 'Battlecard', icon: <Shield className="h-4 w-4" />, check: (c: Competitor) => c.battleCards.length > 0 },
  { key: 'pricing', label: 'Pricing data', icon: <BarChart3 className="h-4 w-4" />, check: (c: Competitor) => (c.managedSources ?? []).some((s) => s.sourceType === 'PRICING') },
]

const ALL_SOURCE_TYPES = ['WEBSITE', 'DOCS', 'BLOG', 'PRICING', 'RELEASE_NOTES', 'REDDIT', 'GITHUB', 'TRUST', 'INTEGRATIONS', 'YOUTUBE']

function CoverageTab({ competitor }: { competitor: Competitor }) {
  const sources = competitor.managedSources ?? []
  const coveredTypes = new Set(sources.map((s) => s.sourceType))
  const missingTypes = ALL_SOURCE_TYPES.filter((t) => !coveredTypes.has(t))

  // Feature coverage by category
  const categories = Array.from(new Set(competitor.features.map((f) => f.category).filter(Boolean)))
  const featureCoverage = categories.map((cat) => {
    const feats = competitor.features.filter((f) => f.category === cat)
    const sourced = feats.filter((f) => f.sourceEvidence.length > 0).length
    const behind = feats.filter((f) => f.matchStatus === 'BEHIND').length
    const ahead = feats.filter((f) => f.matchStatus === 'AHEAD').length
    return { cat, total: feats.length, sourced, behind, ahead }
  })

  return (
    <div className="max-w-3xl space-y-6">
      {/* Section Coverage */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Section Coverage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {KEY_SECTIONS.map((section) => {
            const ok = section.check(competitor)
            const detail = section.detail?.(competitor)
            return (
              <div key={section.key} className={`border rounded-lg p-3 flex items-center gap-3 ${ok ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                <div className={`h-8 w-8 rounded-md flex items-center justify-center ${ok ? 'text-emerald-600 bg-emerald-100' : 'text-amber-600 bg-amber-100'}`}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{section.label}</p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                </div>
                {ok
                  ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Source Type Coverage */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Source Type Coverage</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {ALL_SOURCE_TYPES.map((type) => {
            const meta = SOURCE_TYPE_DISPLAY[type]
            const isCovered = coveredTypes.has(type)
            const src = sources.find((s) => s.sourceType === type)
            const isFailing = src?.status === 'FAILED' || src?.status === 'BLOCKED'
            return (
              <div
                key={type}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                  isFailing ? 'border-red-200 bg-red-50 text-red-700' :
                  isCovered ? (meta?.color ?? 'text-emerald-700 bg-emerald-50 border-emerald-200') :
                  'border-dashed border-muted-foreground/30 text-muted-foreground/60'
                }`}
                title={isCovered ? (isFailing ? 'Failing' : 'Covered') : 'Not configured'}
              >
                {meta?.icon}
                {meta?.label ?? type}
                {isFailing && <TriangleAlert className="h-3 w-3 text-red-500" />}
                {!isCovered && <span className="text-[10px] opacity-50">missing</span>}
              </div>
            )
          })}
        </div>
        {missingTypes.length > 0 && (
          <div className="border border-dashed rounded-lg p-3 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground mb-1">Recommended additions for better coverage:</p>
            <div className="flex flex-wrap gap-1.5">
              {missingTypes.slice(0, 5).map((type) => {
                const meta = SOURCE_TYPE_DISPLAY[type]
                return (
                  <span key={type} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    + {meta?.label ?? type}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Feature Evidence Coverage by Category */}
      {featureCoverage.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Evidence Coverage by Category</h3>
          <div className="space-y-2">
            {featureCoverage.map(({ cat, total, sourced, behind, ahead }) => {
              const pct = total > 0 ? Math.round((sourced / total) * 100) : 0
              return (
                <div key={cat} className="border rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-1.5">
                    <p className="text-sm font-medium flex-1">{cat}</p>
                    <div className="flex items-center gap-2 text-xs">
                      {behind > 0 && <span className="text-red-600 font-medium">−{behind} behind</span>}
                      {ahead > 0 && <span className="text-emerald-600 font-medium">+{ahead} ahead</span>}
                      <span className="text-muted-foreground">{sourced}/{total} sourced</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Gap Analysis</h3>
        {competitor.features.filter((f) => f.matchStatus === 'BEHIND').length === 0 ? (
          <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground bg-muted/20">
            No capability gaps detected. Add features and run a comparison to see gap analysis.
          </div>
        ) : (
          <div className="space-y-2">
            {competitor.features.filter((f) => f.matchStatus === 'BEHIND').slice(0, 5).map((f) => (
              <div key={f.id} className="border border-red-200 rounded-lg p-3 bg-red-50/30 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.category} · {f.sourceEvidence.length} source{f.sourceEvidence.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
            {competitor.features.filter((f) => f.matchStatus === 'BEHIND').length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{competitor.features.filter((f) => f.matchStatus === 'BEHIND').length - 5} more gaps — see Features tab
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
