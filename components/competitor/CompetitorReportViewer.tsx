'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2, FileText, Plus, Download, Copy, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { ReportGenerationModal } from './ReportGenerationModal'
import { formatDistanceToNow } from 'date-fns'

interface ReportVersion {
  id: string
  version: number
  createdAt: string
}

interface CompetitorReport {
  id: string
  title: string
  status: string
  contentMd: string | null
  executiveSummary: string | null
  confidenceOverall: number | null
  evidenceCount: number
  sourceCount: number
  generatedAt: string | null
  modelUsed: string | null
  errorMessage: string | null
  versions: ReportVersion[]
  createdAt: string
}

interface CompetitorReportViewerProps {
  competitorId: string
  competitorName: string
}

const STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  READY: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  STALE: { color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3.5 w-3.5" /> },
  FAILED: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  NOT_GENERATED: { color: 'bg-slate-100 text-slate-600', icon: <FileText className="h-3.5 w-3.5" /> },
}

// Simple markdown renderer — converts headers and lists to HTML-like JSX
function renderMarkdown(md: string) {
  const lines = md.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold mt-6 mb-2 text-foreground">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{line.slice(4)}</h3>
    if (line.startsWith('#### ')) return <h4 key={i} className="text-sm font-medium mt-3 mb-1 text-foreground">{line.slice(5)}</h4>
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <li key={i} className="text-sm text-muted-foreground ml-4 list-disc">{renderInline(line.slice(2))}</li>
    }
    if (/^\d+\./.test(line)) {
      return <li key={i} className="text-sm text-muted-foreground ml-4 list-decimal">{renderInline(line.replace(/^\d+\.\s*/, ''))}</li>
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    if (line.startsWith('---') || line.startsWith('===')) return <hr key={i} className="my-4 border-border" />
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{renderInline(line)}</p>
  })
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function relativeTime(date: string | null) {
  if (!date) return '—'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return date }
}

export function CompetitorReportViewer({ competitorId, competitorName }: CompetitorReportViewerProps) {
  const [reports, setReports] = useState<CompetitorReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<CompetitorReport | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const pollRef = useState<ReturnType<typeof setInterval> | null>(null)

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/competitors/${competitorId}/reports`)
    if (res.ok) setReports(await res.json())
    setLoading(false)
  }, [competitorId])

  useEffect(() => { loadReports() }, [loadReports])

  // Poll if any report is in progress
  useEffect(() => {
    const hasInProgress = reports.some((r) => r.status === 'IN_PROGRESS')
    if (hasInProgress) {
      const interval = setInterval(loadReports, 3000)
      return () => clearInterval(interval)
    }
  }, [reports, loadReports])

  function openReport(report: CompetitorReport) {
    setSelectedReport(report)
    setSheetOpen(true)
  }

  async function copyReport() {
    if (!selectedReport?.contentMd) return
    await navigator.clipboard.writeText(selectedReport.contentMd)
    toast.success('Copied to clipboard')
  }

  function downloadReport() {
    if (!selectedReport?.contentMd) return
    const blob = new Blob([selectedReport.contentMd], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${competitorName.replace(/\s+/g, '-')}-intelligence-report.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded')
  }

  async function deleteReport(reportId: string) {
    const res = await fetch(`/api/competitors/${competitorId}/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      if (selectedReport?.id === reportId) { setSheetOpen(false); setSelectedReport(null) }
      toast.success('Report deleted')
    }
  }

  function handleGenerationComplete(newReportId: string) {
    loadReports()
    const report = reports.find((r) => r.id === newReportId)
    if (report) { setSelectedReport(report); setSheetOpen(true) }
    setGenerateOpen(false)
    // Give time for reports to reload
    setTimeout(() => {
      setReports((prev) => {
        const fresh = prev.find((r) => r.id === newReportId)
        if (fresh) { setSelectedReport(fresh); setSheetOpen(true) }
        return prev
      })
    }, 500)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {reports.length} report{reports.length === 1 ? '' : 's'} generated
          </p>
        </div>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate New Report
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 space-y-3 text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 opacity-30" />
          <p className="font-medium">No reports yet</p>
          <p className="text-sm">Generate your first intelligence report to get a comprehensive view of this competitor.</p>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>Generate Report</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const statusStyle = STATUS_STYLES[report.status] ?? STATUS_STYLES.NOT_GENERATED
            const versExpanded = expandedVersions.has(report.id)
            return (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm">{report.title}</h3>
                      <Badge variant="secondary" className={`text-xs flex items-center gap-1 ${statusStyle.color}`}>
                        {statusStyle.icon}{report.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {report.executiveSummary && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{report.executiveSummary}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      {report.generatedAt && <span>Generated {relativeTime(report.generatedAt)}</span>}
                      {report.modelUsed && <span>{report.modelUsed}</span>}
                      <span>{report.evidenceCount} evidence items</span>
                      {report.confidenceOverall != null && (
                        <span>{Math.round(report.confidenceOverall * 100)}% confidence</span>
                      )}
                    </div>
                    {/* Versions */}
                    {report.versions.length > 1 && (
                      <button
                        className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 hover:text-foreground"
                        onClick={() => setExpandedVersions((prev) => {
                          const n = new Set(prev)
                          if (n.has(report.id)) n.delete(report.id)
                          else n.add(report.id)
                          return n
                        })}
                      >
                        {versExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {report.versions.length} versions
                      </button>
                    )}
                    {versExpanded && (
                      <div className="mt-1 pl-4 space-y-1">
                        {report.versions.map((v) => (
                          <p key={v.id} className="text-xs text-muted-foreground">v{v.version} — {relativeTime(v.createdAt)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {report.status === 'READY' && (
                      <Button size="sm" variant="outline" onClick={() => openReport(report)}>View</Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Report Viewer Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader className="pr-6">
            <SheetTitle className="text-base">{selectedReport?.title}</SheetTitle>
            {selectedReport && (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedReport.generatedAt && (
                  <span className="text-xs text-muted-foreground">Generated {relativeTime(selectedReport.generatedAt)}</span>
                )}
                {selectedReport.modelUsed && (
                  <Badge variant="secondary" className="text-xs">{selectedReport.modelUsed}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">{selectedReport.evidenceCount} evidence</Badge>
              </div>
            )}
          </SheetHeader>

          {selectedReport?.contentMd && (
            <>
              <div className="flex gap-2 mt-4 mb-2">
                <Button size="sm" variant="outline" onClick={copyReport}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Markdown
                </Button>
                <Button size="sm" variant="outline" onClick={downloadReport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download .md
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => selectedReport && deleteReport(selectedReport.id)}
                >
                  Delete
                </Button>
              </div>
              <div className="mt-4 prose prose-sm max-w-none">
                {renderMarkdown(selectedReport.contentMd)}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ReportGenerationModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        competitorId={competitorId}
        competitorName={competitorName}
        onComplete={handleGenerationComplete}
      />
    </div>
  )
}
