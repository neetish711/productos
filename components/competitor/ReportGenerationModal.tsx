'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ReportGenerationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitorId: string
  competitorName: string
  onComplete: (reportId: string) => void
}

const PROGRESS_MESSAGES = [
  'Analyzing competitor features…',
  'Reviewing key updates and changes…',
  'Examining source evidence…',
  'Building competitive comparison…',
  'Generating executive summary…',
  'Writing PM takeaways…',
  'Compiling evidence appendix…',
  'Finalizing report…',
]

export function ReportGenerationModal({
  open,
  onOpenChange,
  competitorId,
  competitorName,
  onComplete,
}: ReportGenerationModalProps) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [messageIdx, setMessageIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearIntervals() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (progressRef.current) clearInterval(progressRef.current)
  }

  async function startGeneration() {
    setStatus('generating')
    setProgress(5)
    setMessageIdx(0)
    setErrorMsg('')

    // Animate progress
    let p = 5
    let m = 0
    progressRef.current = setInterval(() => {
      p = Math.min(p + 1.2, 88)
      setProgress(p)
      if (p > 10 + m * 10) {
        m = Math.min(m + 1, PROGRESS_MESSAGES.length - 1)
        setMessageIdx(m)
      }
    }, 800)

    try {
      const res = await fetch(`/api/competitors/${competitorId}/reports/generate`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.reportId) {
          // Already in progress — poll that
          setReportId(data.reportId)
        } else {
          throw new Error(data.error ?? 'Generation failed')
        }
      } else {
        if (data.reportId) setReportId(data.reportId)
      }

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/competitors/${competitorId}/reports`)
          if (!pollRes.ok) return
          const reports = await pollRes.json()
          const latest = reports[0]
          if (!latest) return

          if (latest.status === 'READY') {
            clearIntervals()
            setProgress(100)
            setStatus('done')
            setReportId(latest.id)
            onComplete(latest.id)
          } else if (latest.status === 'FAILED') {
            clearIntervals()
            setStatus('error')
            setErrorMsg(latest.errorMessage ?? 'Report generation failed')
          }
        } catch { /* keep polling */ }
      }, 3000)
    } catch (err) {
      clearIntervals()
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    if (!open) {
      clearIntervals()
      setStatus('idle')
      setProgress(0)
      setMessageIdx(0)
      setErrorMsg('')
    }
  }, [open])

  useEffect(() => () => clearIntervals(), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Intelligence Report</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {status === 'idle' && (
            <>
              <p className="text-sm text-muted-foreground">
                Generate a comprehensive 13-section intelligence report for <strong>{competitorName}</strong> using your tracked features, key updates, and source evidence.
              </p>
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                This uses your configured AI model. Generation typically takes 30–90 seconds.
              </p>
              <Button className="w-full" onClick={startGeneration}>
                Generate Report
              </Button>
            </>
          )}

          {status === 'generating' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">Generating report…</p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{PROGRESS_MESSAGES[messageIdx]}</p>
              <p className="text-xs text-muted-foreground/60">This may take up to 90 seconds</p>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-700">Report generated successfully!</p>
              </div>
              <Button className="w-full" onClick={() => { onOpenChange(false); if (reportId) onComplete(reportId) }}>
                View Report
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Generation failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Close</Button>
                <Button className="flex-1" onClick={startGeneration}>Retry</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
