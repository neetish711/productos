'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, X, Plus } from 'lucide-react'

const LOG_MESSAGES = [
  'Fetching sources...',
  'Extracting features...',
  'Comparing against known data...',
  'Detecting changes...',
  'Generating summaries...',
  'Finalizing...',
]

const LLM_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
]

type Phase = 'setup' | 'running' | 'complete'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitorNames: string[]
  initialSources?: { url: string }[]
  onComplete?: () => void
}

export function CrawlSetupModal({ open, onOpenChange, competitorNames, initialSources, onComplete }: Props) {
  const [phase, setPhase] = React.useState<Phase>('setup')
  const [sources, setSources] = React.useState<{ url: string }[]>([])
  const [scope, setScope] = React.useState({
    newFeatures: true,
    keyUpdates: true,
    pricingSignals: true,
    partnershipSignals: true,
  })
  const [llm, setLlm] = React.useState('claude-sonnet-4-6')
  const [progressPct, setProgressPct] = React.useState(0)
  const [logMessages, setLogMessages] = React.useState<string[]>([])
  const [logIndex, setLogIndex] = React.useState(0)
  const [results] = React.useState({ newFeatures: 3, updatedFeatures: 7, changesDetected: 4, sourcesProcessed: 0 })

  // Initialize state on open
  React.useEffect(() => {
    if (open) {
      setPhase('setup')
      setProgressPct(0)
      setLogMessages([])
      setLogIndex(0)
      const savedLlm = localStorage.getItem('crawl_llm_preference')
      if (savedLlm) setLlm(savedLlm)
      const initial = initialSources && initialSources.length > 0
        ? initialSources
        : competitorNames.map(() => ({ url: '' }))
      setSources(initial)
    }
  }, [open])

  // Progress animation
  React.useEffect(() => {
    if (phase !== 'running') return
    const interval = setInterval(() => {
      setProgressPct((prev) => {
        const next = prev + 100 / (LOG_MESSAGES.length * 2.5)
        if (next >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setPhase('complete')
            onComplete?.()
          }, 500)
          return 100
        }
        return next
      })
      setLogIndex((prev) => {
        const next = prev + 1
        if (next < LOG_MESSAGES.length) {
          setLogMessages((msgs) => [...msgs, LOG_MESSAGES[next]])
        }
        return next
      })
    }, 600)
    return () => clearInterval(interval)
  }, [phase])

  function startCrawl() {
    localStorage.setItem('crawl_llm_preference', llm)
    setLogMessages([LOG_MESSAGES[0]])
    setLogIndex(0)
    setProgressPct(0)
    setPhase('running')
  }

  const validSources = sources.filter((s) => s.url.trim())

  return (
    <Dialog open={open} onOpenChange={(v) => { if (phase !== 'running') onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        {phase === 'setup' && (
          <>
            <DialogHeader>
              <DialogTitle>Re-crawl Competitors</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-1">
              {/* Competitor names */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Selected competitors</Label>
                <div className="flex flex-wrap gap-1.5">
                  {competitorNames.map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sources to crawl</Label>
                <div className="space-y-1.5">
                  {sources.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={s.url}
                        onChange={(e) => setSources((prev) => prev.map((x, j) => j === i ? { url: e.target.value } : x))}
                        placeholder="https://example.com"
                        className="text-sm h-8"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setSources((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSources((prev) => [...prev, { url: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" />Add source
                </Button>
              </div>

              {/* Extraction scope */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Extraction scope</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'newFeatures', label: 'New features' },
                    { key: 'keyUpdates', label: 'Key updates' },
                    { key: 'pricingSignals', label: 'Pricing signals' },
                    { key: 'partnershipSignals', label: 'Partnership signals' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                      <input
                        type="checkbox"
                        checked={scope[key]}
                        onChange={(e) => setScope((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-border"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* LLM */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">LLM model</Label>
                <Select value={llm} onValueChange={setLlm}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Public web only */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Public web only</p>
                  <p className="text-xs text-muted-foreground">Only publicly accessible pages are crawled</p>
                </div>
                <Switch checked disabled />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={startCrawl} disabled={validSources.length === 0}>
                Start Re-crawl
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === 'running' && (
          <>
            <DialogHeader>
              <DialogTitle>Crawling in progress…</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Progress value={progressPct} className="h-2" />
              <div className="space-y-1.5 min-h-[120px]">
                {logMessages.map((msg, i) => (
                  <p key={i} className={`text-sm ${i === logMessages.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {i === logMessages.length - 1 ? '▸ ' : '✓ '}{msg}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        {phase === 'complete' && (
          <>
            <DialogHeader>
              <DialogTitle>Crawl complete</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'New Features', value: results.newFeatures },
                  { label: 'Updated Features', value: results.updatedFeatures },
                  { label: 'Changes Detected', value: results.changesDetected },
                  { label: 'Sources Processed', value: validSources.length },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
