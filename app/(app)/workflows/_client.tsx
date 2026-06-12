'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Play, CheckCircle2, XCircle, Clock, Loader2,
  ChevronRight, RefreshCw, Activity, Search
} from 'lucide-react'
import { formatDateTime, formatTokens, formatCost } from '@/lib/utils'

interface WorkflowStep {
  id: string
  stepName: string
  status: string
  output: string | null
  tokensUsed: number
  createdAt: Date
  updatedAt: Date
}

interface WorkflowRun {
  id: string
  workflowType: string
  status: string
  steps: WorkflowStep[]
  tokensUsed: number
  estimatedCost: number | null
  createdAt: Date
  updatedAt: Date
}

interface Competitor {
  id: string
  name: string
}

interface Props {
  runs: WorkflowRun[]
  competitors: Competitor[]
}

const STATUS_CONFIG = {
  PENDING: { color: 'secondary', icon: Clock },
  RUNNING: { color: 'warning', icon: Loader2 },
  COMPLETED: { color: 'success', icon: CheckCircle2 },
  FAILED: { color: 'destructive', icon: XCircle },
} as const

export function WorkflowsClient({ runs: initial, competitors }: Props) {
  const router = useRouter()
  const [runs, setRuns] = useState(initial)
  const [launching, setLaunching] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deepAnalysisOpen, setDeepAnalysisOpen] = useState(false)
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('')
  const [launchingDeep, setLaunchingDeep] = useState(false)

  // Poll running workflows every 3 seconds
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'RUNNING' || r.status === 'PENDING')
    if (!hasRunning) return

    const interval = setInterval(async () => {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json()
        setRuns(data.filter((r: WorkflowRun) => r.status === 'RUNNING' || r.status === 'PENDING'))
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [runs])

  const launchDeepAnalysis = async () => {
    if (!selectedCompetitorId) return
    setLaunchingDeep(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowType: 'COMPETITOR_DEEP_ANALYSIS', competitorId: selectedCompetitorId }),
      })
      if (!res.ok) throw new Error()
      const run = await res.json()
      setRuns(prev => [run, ...prev])
      setDeepAnalysisOpen(false)
      setSelectedCompetitorId('')
      toast.success('Deep analysis workflow started')
    } catch {
      toast.error('Failed to launch workflow')
    } finally {
      setLaunchingDeep(false)
    }
  }

  const launchRefresh = async () => {
    setLaunching(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowType: 'COMPETITOR_REFRESH' }),
      })
      if (!res.ok) throw new Error()
      const run = await res.json()
      setRuns(prev => [run, ...prev])
      toast.success('Competitor refresh workflow started')
    } catch {
      toast.error('Failed to launch workflow')
    } finally {
      setLaunching(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getStepProgress = (run: WorkflowRun) => {
    if (run.steps.length === 0) return 0
    const done = run.steps.filter(s => s.status === 'COMPLETED' || s.status === 'FAILED').length
    return Math.round((done / run.steps.length) * 100)
  }

  const deepAnalysisDialog = (
    <Dialog open={deepAnalysisOpen} onOpenChange={setDeepAnalysisOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Competitor Analysis</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Runs a 6-step deep analysis: source audit, evidence collection, community signals,
            change detection, report generation, and battle card update.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Select Competitor</label>
            <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a competitor..." />
              </SelectTrigger>
              <SelectContent>
                {competitors.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeepAnalysisOpen(false)}>Cancel</Button>
          <Button onClick={launchDeepAnalysis} disabled={!selectedCompetitorId || launchingDeep}>
            {launchingDeep ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Start Analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (runs.length === 0) {
    return (
      <div className="p-6 space-y-6">
        {deepAnalysisDialog}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Active Workflows</h1>
            <p className="text-muted-foreground text-sm mt-1">Monitor running AI workflows</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDeepAnalysisOpen(true)} disabled={competitors.length === 0}>
              <Search className="h-4 w-4 mr-2" />
              Competitor Analysis
            </Button>
            <Button onClick={launchRefresh} disabled={launching}>
              {launching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Competitor Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
          <h3 className="font-semibold text-lg">No active workflows</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Launch a competitor refresh or deep analysis to see workflow progress here
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeepAnalysisOpen(true)} disabled={competitors.length === 0}>
              <Search className="h-4 w-4 mr-2" />
              Competitor Analysis
            </Button>
            <Button onClick={launchRefresh} disabled={launching}>
              {launching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Competitor Refresh
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {deepAnalysisDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Active Workflows</h1>
          <p className="text-muted-foreground text-sm mt-1">{runs.length} active run(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeepAnalysisOpen(true)} disabled={competitors.length === 0}>
            <Search className="h-4 w-4 mr-1" />
            Competitor Analysis
          </Button>
          <Button size="sm" onClick={launchRefresh} disabled={launching}>
            {launching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Refresh All
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {runs.map(run => {
          const config = STATUS_CONFIG[run.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.RUNNING
          const Icon = config.icon
          const progress = getStepProgress(run)
          const isExpanded = expanded.has(run.id)

          return (
            <Card key={run.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${run.status === 'RUNNING' ? 'animate-spin text-amber-500' : ''}`} />
                    <div>
                      <CardTitle className="text-base">
                        {run.workflowType.replace(/_/g, ' ')}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.color as any}>{run.status}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(run.id)}
                      className="h-7"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{run.steps.filter(s => s.status === 'COMPLETED').length} / {run.steps.length} steps</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{formatTokens(run.tokensUsed)} tokens</span>
                  {run.estimatedCost && <span>~${run.estimatedCost.toFixed(4)}</span>}
                </div>
              </CardHeader>

              {isExpanded && run.steps.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-2 border-t pt-3">
                    {run.steps.map((step, i) => {
                      const stepConfig = STATUS_CONFIG[step.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING
                      const StepIcon = stepConfig.icon
                      return (
                        <div key={step.id} className="flex items-start gap-3 text-sm">
                          <StepIcon className={`h-4 w-4 mt-0.5 shrink-0 ${step.status === 'RUNNING' ? 'animate-spin text-amber-500' : step.status === 'COMPLETED' ? 'text-green-500' : step.status === 'FAILED' ? 'text-red-500' : 'text-muted-foreground'}`} />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{step.stepName.replace(/_/g, ' ')}</span>
                            {step.output && (
                              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{step.output}</p>
                            )}
                          </div>
                          {step.tokensUsed > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTokens(step.tokensUsed)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
