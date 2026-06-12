'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDateTime, formatTokens } from '@/lib/utils'

interface WorkflowStep {
  id: string
  stepName: string
  status: string
  output: string | null
  tokensUsed: number
  createdAt: Date
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

const STATUS_ICON = {
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  RUNNING: Loader2,
  PENDING: Clock,
}

const STATUS_COLOR = {
  COMPLETED: 'success',
  FAILED: 'destructive',
  RUNNING: 'warning',
  PENDING: 'secondary',
} as const

export function WorkflowHistoryClient({ runs }: { runs: WorkflowRun[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Workflow History</h1>
        <p className="text-muted-foreground text-sm mt-1">{runs.length} total runs</p>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No workflow runs yet. Run a competitor refresh to get started.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-semibold">Workflow</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Steps</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Tokens</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Cost</th>
                <th className="text-left px-4 py-3 text-sm font-semibold">Started</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const Icon = STATUS_ICON[run.status as keyof typeof STATUS_ICON] || Clock
                const isExpanded = expanded.has(run.id)
                const completedSteps = run.steps.filter(s => s.status === 'COMPLETED').length

                return (
                  <>
                    <tr key={run.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm font-medium">
                        {run.workflowType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`h-4 w-4 ${run.status === 'RUNNING' ? 'animate-spin text-amber-500' : ''}`} />
                          <Badge variant={STATUS_COLOR[run.status as keyof typeof STATUS_COLOR] || 'secondary'} className="text-xs">
                            {run.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {completedSteps}/{run.steps.length}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatTokens(run.tokensUsed)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {run.estimatedCost ? `$${run.estimatedCost.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateTime(run.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {run.steps.length > 0 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(run.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${run.id}-steps`} className="bg-muted/30">
                        <td colSpan={7} className="px-8 py-3">
                          <div className="space-y-1.5">
                            {run.steps.map(step => {
                              const StepIcon = STATUS_ICON[step.status as keyof typeof STATUS_ICON] || Clock
                              return (
                                <div key={step.id} className="flex items-center gap-2 text-sm">
                                  <StepIcon className={`h-3.5 w-3.5 shrink-0 ${
                                    step.status === 'COMPLETED' ? 'text-green-500' :
                                    step.status === 'FAILED' ? 'text-red-500' :
                                    'text-muted-foreground'
                                  }`} />
                                  <span className="font-medium">{step.stepName.replace(/_/g, ' ')}</span>
                                  {step.tokensUsed > 0 && (
                                    <span className="text-muted-foreground text-xs">{formatTokens(step.tokensUsed)} tokens</span>
                                  )}
                                  {step.output && (
                                    <span className="text-muted-foreground text-xs truncate max-w-xs">{step.output}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
