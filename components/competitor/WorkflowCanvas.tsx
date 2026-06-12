'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Search, Layers, ScanSearch, Sparkles, Play, RefreshCw, CheckCircle, AlertCircle,
  XCircle, Clock, ChevronRight, ChevronDown, ArrowRight, Activity, Loader2,
  FileText, Shield, GitBranch, Zap, Database, Plus, TriangleAlert, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn, timeAgo } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type NodeStatus = 'not-started' | 'in-progress' | 'complete' | 'warning' | 'failed' | 'skipped'

interface WfNode {
  id: string
  label: string
  description: string
  status: NodeStatus
  detail?: string
  optional?: boolean
  tokens?: number
  action?: string
}

interface WfLane {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  nodes: WfNode[]
}

interface RunStep {
  name: string
  status: string
  tokensUsed: number
}

interface WorkflowRun {
  id: string
  type: string
  status: string
  totalTokens: number
  estimatedCost: number
  errorMessage?: string
  startedAt: string
  completedAt?: string
  steps: RunStep[]
}

interface Guidance {
  priority: number
  message: string
  action: string
  actionLabel: string
}

interface WorkflowData {
  setup: {
    sources: number
    features: number
    evidenceBacked: number
    staleSources: number
    failedSources: number
    hasReport: boolean
    hasBattleCard: boolean
    lastRefresh: string | null
  }
  preflight: {
    deepAnalysis: { ok: boolean; errors: string[] }
    refresh: { ok: boolean; errors: string[] }
  }
  inFlight: {
    deepAnalysis: { id: string } | null
    refresh: { id: string } | null
  }
  recentRuns: WorkflowRun[]
  guidance: Guidance
}

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<NodeStatus, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  'not-started': { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-muted', icon: <Clock className="h-3.5 w-3.5" />, label: 'Not started' },
  'in-progress': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Running' },
  'complete': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Complete' },
  'warning': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Needs attention' },
  'failed': { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Failed' },
  'skipped': { color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200 border-dashed', icon: <ChevronRight className="h-3.5 w-3.5" />, label: 'Skipped' },
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WorkflowCanvas({ competitorId, competitorName }: { competitorId: string; competitorName: string }) {
  const [data, setData] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pollingRun, setPollingRun] = useState<any>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/competitor/${competitorId}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        // If something is in-flight, start polling
        if (d.inFlight.deepAnalysis || d.inFlight.refresh) {
          setActiveRunId(d.inFlight.deepAnalysis?.id || d.inFlight.refresh?.id)
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [competitorId])

  useEffect(() => { fetchData() }, [fetchData])

  // Poll for active run status
  useEffect(() => {
    if (!activeRunId) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/workflows/runs/${activeRunId}`)
      if (res.ok) {
        const run = await res.json()
        setPollingRun(run)
        if (run.status === 'COMPLETED' || run.status === 'FAILED') {
          setActiveRunId(null)
          setRunningWorkflow(null)
          setPollingRun(null)
          fetchData() // Refresh all data
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [activeRunId, fetchData])

  const triggerWorkflow = async (type: string) => {
    setRunningWorkflow(type)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowType: type, competitorId }),
      })
      const result = await res.json()
      if (!res.ok) {
        if (res.status === 422) {
          toast.error('Setup incomplete', { description: result.preflightErrors?.join('. ') })
        } else {
          toast.error(result.error || 'Failed to start workflow')
        }
        setRunningWorkflow(null)
        return
      }
      if (result.alreadyRunning) {
        toast.info('Workflow already in progress')
      } else {
        toast.success(`${type === 'COMPETITOR_DEEP_ANALYSIS' ? 'Deep Analysis' : 'Refresh'} started`)
      }
      setActiveRunId(result.id)
      fetchData()
    } catch {
      toast.error('Failed to start workflow')
      setRunningWorkflow(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-center text-muted-foreground py-12">Failed to load workflow data.</div>
  }

  // Build lanes from live data
  const setupLane = buildSetupLane(data.setup)
  const intelligenceLane = buildIntelligenceLane(data, pollingRun)
  const outputLane = buildOutputLane(data.setup)

  return (
    <div className="max-w-5xl space-y-4">
      {/* Guided Banner */}
      <GuidedBanner guidance={data.guidance} onAction={(action) => {
        if (action === 'run-deep' || action === 'retry') triggerWorkflow('COMPETITOR_DEEP_ANALYSIS')
        else if (action === 'run-refresh') triggerWorkflow('COMPETITOR_REFRESH')
        else if (action === 'view-run' && activeRunId) setHistoryOpen(true)
      }} />

      {/* 3-Lane Canvas */}
      <div className="space-y-1">
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center gap-1 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
          ))}
        </div>

        {/* Lane 1: Setup */}
        <Lane lane={setupLane} />

        {/* Arrow between lanes */}
        <div className="flex justify-center py-0.5">
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 rotate-90" />
        </div>

        {/* Lane 2: Intelligence */}
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-violet-50/50 border-b border-violet-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold">Intelligence Workflows</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Deep Analysis */}
            <WorkflowGroup
              label="Deep Analysis"
              description="6-step analysis: audit → collect → community → detect → report → battlecard"
              nodes={intelligenceLane.deepAnalysis}
              canRun={data.preflight.deepAnalysis.ok}
              preflightErrors={data.preflight.deepAnalysis.errors}
              isRunning={runningWorkflow === 'COMPETITOR_DEEP_ANALYSIS' || !!data.inFlight.deepAnalysis}
              onRun={() => triggerWorkflow('COMPETITOR_DEEP_ANALYSIS')}
            />
            <div className="border-t" />
            {/* Refresh */}
            <WorkflowGroup
              label="Refresh"
              description="3-step refresh: crawl → detect changes → analyze gaps"
              nodes={intelligenceLane.refresh}
              canRun={data.preflight.refresh.ok}
              preflightErrors={data.preflight.refresh.errors}
              isRunning={runningWorkflow === 'COMPETITOR_REFRESH' || !!data.inFlight.refresh}
              onRun={() => triggerWorkflow('COMPETITOR_REFRESH')}
            />
          </div>
        </div>

        {/* Arrow between lanes */}
        <div className="flex justify-center py-0.5">
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 rotate-90" />
        </div>

        {/* Lane 3: Outputs */}
        <Lane lane={outputLane} />
      </div>

      {/* Run History toggle */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <Activity className="h-3.5 w-3.5 mr-1.5" />
          Run History ({data.recentRuns.length})
        </Button>
      </div>

      {/* Run History Drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-auto">
          <SheetHeader>
            <SheetTitle>Run History — {competitorName}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {data.recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No runs yet.</p>
            ) : (
              data.recentRuns.map((run) => <RunCard key={run.id} run={run} onRerun={() => triggerWorkflow(run.type)} />)
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function GuidedBanner({ guidance, onAction }: { guidance: Guidance; onAction: (action: string) => void }) {
  if (guidance.priority >= 7) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-800 flex-1">{guidance.message}</p>
      </div>
    )
  }

  const colors = guidance.priority <= 2
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : guidance.priority === 4
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-blue-200 bg-blue-50 text-blue-800'

  const icon = guidance.priority <= 2
    ? <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
    : guidance.priority === 3
    ? <Loader2 className="h-5 w-5 text-blue-600 shrink-0 animate-spin" />
    : guidance.priority === 4
    ? <XCircle className="h-5 w-5 text-red-600 shrink-0" />
    : <Info className="h-5 w-5 text-blue-600 shrink-0" />

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${colors}`}>
      {icon}
      <p className="text-sm font-medium flex-1">{guidance.message}</p>
      {guidance.actionLabel && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onAction(guidance.action)}>
          {guidance.actionLabel}
        </Button>
      )}
    </div>
  )
}

function Lane({ lane }: { lane: WfLane }) {
  return (
    <div className={`border rounded-xl overflow-hidden`}>
      <div className={`px-4 py-3 ${lane.color} border-b flex items-center gap-2`}>
        {lane.icon}
        <span className="text-sm font-semibold">{lane.label}</span>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {lane.nodes.map((node, i) => (
          <React.Fragment key={node.id}>
            <NodeCard node={node} />
            {i < lane.nodes.length - 1 && (
              <div className="flex items-center">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function NodeCard({ node }: { node: WfNode }) {
  const cfg = STATUS_CONFIG[node.status]
  return (
    <div className={cn('border rounded-lg p-3 min-w-[140px] max-w-[180px] flex-1', cfg.border, cfg.bg)}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-xs font-semibold leading-tight">{node.label}</p>
        <span className={cfg.color}>{cfg.icon}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{node.description}</p>
      {node.detail && (
        <p className={`text-[10px] mt-1 font-medium ${cfg.color}`}>{node.detail}</p>
      )}
      {node.optional && (
        <Badge variant="outline" className="text-[9px] mt-1 px-1 py-0">optional</Badge>
      )}
    </div>
  )
}

function WorkflowGroup({ label, description, nodes, canRun, preflightErrors, isRunning, onRun }: {
  label: string; description: string; nodes: WfNode[]; canRun: boolean; preflightErrors: string[]; isRunning: boolean; onRun: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-left" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
        </button>
        <div className="relative group">
          <Button
            size="sm"
            disabled={!canRun || isRunning}
            onClick={onRun}
            className="gap-1.5"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? 'Running...' : 'Run'}
          </Button>
          {!canRun && preflightErrors.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block w-60 p-2 rounded border bg-popover text-xs text-muted-foreground shadow-md">
              <p className="font-medium text-destructive mb-1">Setup incomplete:</p>
              {preflightErrors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2 pl-5">
          {nodes.map((node, i) => (
            <React.Fragment key={node.id}>
              <NodeCard node={node} />
              {i < nodes.length - 1 && (
                <div className="flex items-center">
                  <ArrowRight className={cn('h-3 w-3', node.optional ? 'text-muted-foreground/20' : 'text-muted-foreground/40')} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function RunCard({ run, onRerun }: { run: WorkflowRun; onRerun: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const statusColor = run.status === 'COMPLETED' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : run.status === 'FAILED' ? 'text-red-600 bg-red-50 border-red-200'
    : run.status === 'RUNNING' ? 'text-blue-600 bg-blue-50 border-blue-200'
    : 'text-muted-foreground bg-muted border-muted'

  const duration = run.completedAt
    ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
    : 'Running...'

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{run.status}</Badge>
          <span className="text-xs font-medium">{run.type.replace('COMPETITOR_', '').replace('_', ' ')}</span>
        </div>
        <div className="flex items-center gap-1">
          {run.status === 'FAILED' && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onRerun}>
              <RefreshCw className="h-3 w-3 mr-1" />Re-run
            </Button>
          )}
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{timeAgo(new Date(run.startedAt))}</span>
        <span>{duration}</span>
        <span>{run.totalTokens.toLocaleString()} tokens</span>
        {run.estimatedCost > 0 && <span>${run.estimatedCost.toFixed(4)}</span>}
      </div>
      {run.errorMessage && (
        <p className="text-[10px] text-red-600 mt-1">{run.errorMessage}</p>
      )}
      {expanded && (
        <div className="mt-2 border-t pt-2 space-y-1">
          {run.steps.map((step) => {
            const stepColor = step.status === 'COMPLETED' ? 'text-emerald-600'
              : step.status === 'FAILED' ? 'text-red-600'
              : step.status === 'RUNNING' ? 'text-blue-600'
              : step.status === 'SKIPPED' ? 'text-gray-400'
              : 'text-muted-foreground'
            return (
              <div key={step.name} className="flex items-center justify-between text-xs">
                <span className={stepColor}>{step.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${stepColor}`}>{step.status}</Badge>
                  {step.tokensUsed > 0 && <span className="text-muted-foreground">{step.tokensUsed} tok</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Lane Builders ──────────────────────────────────────────────────────────

function buildSetupLane(setup: WorkflowData['setup']): WfLane {
  return {
    id: 'setup',
    label: 'Setup',
    icon: <Database className="h-4 w-4 text-blue-600" />,
    color: 'bg-blue-50/50 border-blue-200',
    nodes: [
      {
        id: 'competitor',
        label: 'Competitor',
        description: 'Basic competitor profile',
        status: 'complete',
        detail: 'Created',
      },
      {
        id: 'sources',
        label: 'Managed Sources',
        description: 'Web pages, docs, pricing, blog',
        status: setup.sources > 0
          ? setup.staleSources > 0 ? 'warning' : 'complete'
          : 'not-started',
        detail: setup.sources > 0
          ? `${setup.sources} sources${setup.staleSources > 0 ? ` (${setup.staleSources} stale)` : ''}`
          : 'No sources configured',
      },
      {
        id: 'features',
        label: 'Features',
        description: 'Tracked competitor capabilities',
        status: setup.features > 0 ? 'complete' : 'not-started',
        detail: setup.features > 0
          ? `${setup.features} features (${setup.evidenceBacked} evidence-backed)`
          : 'No features tracked',
      },
      {
        id: 'evidence',
        label: 'Source Evidence',
        description: 'Per-feature evidence links',
        status: setup.evidenceBacked > 0 ? 'complete' : setup.features > 0 ? 'warning' : 'not-started',
        detail: setup.evidenceBacked > 0
          ? `${setup.evidenceBacked} features with evidence`
          : 'No evidence linked',
      },
    ],
  }
}

function buildIntelligenceLane(data: WorkflowData, pollingRun: any): { deepAnalysis: WfNode[]; refresh: WfNode[] } {
  // If we have a polling run, use its step statuses
  const mapStepStatus = (stepName: string): NodeStatus => {
    if (!pollingRun) return 'not-started'
    const step = pollingRun.steps?.find((s: any) => s.name === stepName)
    if (!step) return 'not-started'
    if (step.status === 'COMPLETED') return 'complete'
    if (step.status === 'RUNNING') return 'in-progress'
    if (step.status === 'FAILED') return 'failed'
    if (step.status === 'SKIPPED') return 'skipped'
    return 'not-started'
  }

  const mapStepDetail = (stepName: string): string => {
    if (!pollingRun) {
      // Use last run if available
      const lastRun = data.recentRuns.find((r) => r.type === 'COMPETITOR_DEEP_ANALYSIS')
      if (lastRun) {
        const step = lastRun.steps.find((s) => s.name === stepName)
        if (step) return `Last: ${step.status}${step.tokensUsed ? ` (${step.tokensUsed} tok)` : ''}`
      }
      return ''
    }
    const step = pollingRun.steps?.find((s: any) => s.name === stepName)
    return step?.output?.summary || step?.output?.error || ''
  }

  const getLastRunStepStatus = (workflowType: string, stepName: string): NodeStatus => {
    if (pollingRun && pollingRun.type === workflowType) return mapStepStatus(stepName)
    const lastRun = data.recentRuns.find((r) => r.type === workflowType)
    if (!lastRun) return 'not-started'
    const step = lastRun.steps.find((s) => s.name === stepName)
    if (!step) return 'not-started'
    if (step.status === 'COMPLETED') return 'complete'
    if (step.status === 'FAILED') return 'failed'
    if (step.status === 'SKIPPED') return 'skipped'
    return 'not-started'
  }

  const deepAnalysis: WfNode[] = [
    { id: 'SOURCE_AUDIT', label: 'Source Audit', description: 'Check source health & staleness', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'SOURCE_AUDIT'), detail: data.setup.staleSources > 0 ? `${data.setup.staleSources} stale` : '' },
    { id: 'EVIDENCE_COLLECTION', label: 'Evidence Collection', description: 'Extract signals from sources', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'EVIDENCE_COLLECTION') },
    { id: 'COMMUNITY_SIGNALS', label: 'Community Signals', description: 'Reddit/HN search queries', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'COMMUNITY_SIGNALS'), optional: true },
    { id: 'CHANGE_DETECTION', label: 'Change Detection', description: 'Infer product changes', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'CHANGE_DETECTION') },
    { id: 'REPORT_GENERATION', label: 'Report Generation', description: '13-section intel report', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'REPORT_GENERATION'), optional: true },
    { id: 'BATTLECARD_UPDATE', label: 'Battlecard Update', description: 'Flag battlecard for refresh', status: getLastRunStepStatus('COMPETITOR_DEEP_ANALYSIS', 'BATTLECARD_UPDATE'), optional: true },
  ]

  const refresh: WfNode[] = [
    { id: 'CRAWL_COMPETITORS', label: 'Crawl Competitors', description: 'Synthesize recent features', status: getLastRunStepStatus('COMPETITOR_REFRESH', 'CRAWL_COMPETITORS') },
    { id: 'DETECT_CHANGES', label: 'Detect Changes', description: 'Find feature updates', status: getLastRunStepStatus('COMPETITOR_REFRESH', 'DETECT_CHANGES'), optional: true },
    { id: 'ANALYZE_GAPS', label: 'Analyze Gaps', description: 'Identify feature gaps', status: getLastRunStepStatus('COMPETITOR_REFRESH', 'ANALYZE_GAPS'), optional: true },
  ]

  return { deepAnalysis, refresh }
}

function buildOutputLane(setup: WorkflowData['setup']): WfLane {
  return {
    id: 'outputs',
    label: 'Outputs',
    icon: <Sparkles className="h-4 w-4 text-rose-600" />,
    color: 'bg-rose-50/50 border-rose-200',
    nodes: [
      {
        id: 'report',
        label: 'Intelligence Report',
        description: '13-section analysis document',
        status: setup.hasReport ? 'complete' : 'not-started',
        detail: setup.hasReport ? 'Report ready' : 'Not generated',
      },
      {
        id: 'battlecard',
        label: 'Battle Card',
        description: 'Sales-ready competitive brief',
        status: setup.hasBattleCard ? 'complete' : 'not-started',
        detail: setup.hasBattleCard ? 'Battle card available' : 'Not generated',
      },
      {
        id: 'comparisons',
        label: 'Comparisons',
        description: 'Feature-level competitive analysis',
        status: setup.features > 0 ? 'complete' : 'not-started',
        detail: setup.features > 0 ? `${setup.features} features tracked` : 'No comparisons',
      },
      {
        id: 'roadmap-gaps',
        label: 'Roadmap Gaps',
        description: 'AI-suggested roadmap items',
        status: 'not-started',
        detail: 'Run Refresh to detect',
      },
    ],
  }
}
