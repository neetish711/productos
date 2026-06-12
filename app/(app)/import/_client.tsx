'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  FileText, FileSpreadsheet, GitCompare,
  Upload, CheckCircle2, XCircle, Loader2,
  RefreshCw, Info, X, Play,
} from 'lucide-react'

type Purpose = 'features' | 'competitors' | 'comparisons'

type Phase =
  | { type: 'idle' }
  | { type: 'uploading'; progress: number; filename: string }
  | { type: 'uploaded'; filename: string; stageKey: string; ext: string }
  | { type: 'parsing'; filename: string }
  | { type: 'success'; filename: string; result: Record<string, unknown> }
  | { type: 'error'; filename: string; message: string }

const CONFIGS = [
  {
    purpose: 'features' as Purpose,
    title: 'Product Feature List',
    description: 'PDF or Excel listing your current product features. Populates Our Features.',
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    acceptLabel: 'PDF or XLSX',
    icon: FileText,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    example: 'e.g. featurelist_ai_supportagent.pdf',
    populates: ['Our Features', 'Comparisons', 'Roadmap'],
  },
  {
    purpose: 'competitors' as Purpose,
    title: 'Competitive Analysis',
    description: 'Excel with competitor names and features. Populates Competitors and Battle Cards.',
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
    },
    acceptLabel: 'XLSX',
    icon: FileSpreadsheet,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    example: 'e.g. AI Support Agent Competitive Analysis.xlsx',
    populates: ['Competitors', 'Battle Cards', 'Feature Comparisons'],
  },
  {
    purpose: 'comparisons' as Purpose,
    title: 'Roadmap Feature Comparison',
    description: 'Excel matrix: our features as rows, competitors as columns.',
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
    },
    acceptLabel: 'XLSX',
    icon: GitCompare,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    example: 'e.g. Roadmap Feature Comparison.xlsx',
    populates: ['Feature Comparisons', 'Gap Analysis'],
  },
]

type ZoneProps = {
  config: (typeof CONFIGS)[0]
  phase: Phase
  onDrop: (file: File) => void
  onCancel: () => void
  onParse: () => void
  onReset: () => void
}

function UploadZone({ config, phase, onDrop, onCancel, onParse, onReset }: ZoneProps) {
  const Icon = config.icon

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted[0] && onDrop(accepted[0]),
    accept: config.accept as any,
    maxFiles: 1,
    disabled: phase.type !== 'idle',
  })

  const border =
    phase.type === 'success' ? 'border-green-400' :
    phase.type === 'error' ? 'border-red-400' :
    phase.type === 'uploaded' ? 'border-blue-400' : ''

  return (
    <Card className={border}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor} shrink-0`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{config.title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">{config.description}</CardDescription>
          </div>
          {phase.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-1" />}
          {phase.type === 'error' && <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-1" />}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {config.populates.map((p) => (
            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">

        {phase.type === 'idle' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop to upload' : 'Drag and drop or click to select'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config.acceptLabel} — {config.example}
            </p>
          </div>
        )}

        {phase.type === 'uploading' && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{phase.filename}</span>
              </div>
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
                onClick={onCancel}
              >
                <X className="h-3.5 w-3.5 mr-1" />Cancel
              </Button>
            </div>
            <Progress value={phase.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{phase.progress}% uploaded</p>
          </div>
        )}

        {phase.type === 'uploaded' && (
          <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300 truncate">
                {phase.filename}
              </span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Upload complete. Click Parse and Import to extract data and populate the platform.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onParse} className="flex-1">
                <Play className="h-3.5 w-3.5 mr-1.5" />Parse and Import
              </Button>
              <Button size="sm" variant="ghost" onClick={onReset} className="text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" />Remove
              </Button>
            </div>
          </div>
        )}

        {phase.type === 'parsing' && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Parsing {phase.filename}</p>
              <p className="text-xs text-muted-foreground">Extracting data and populating the database</p>
            </div>
          </div>
        )}

        {phase.type === 'success' && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 space-y-2">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Imported — {phase.filename}
            </p>
            <div className="text-xs text-green-700 dark:text-green-400 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {phase.result.created !== undefined && (
                <span>Records created: <strong>{String(phase.result.created)}</strong></span>
              )}
              {phase.result.features !== undefined && (
                <span>Features: <strong>{String(phase.result.features)}</strong></span>
              )}
              {phase.result.competitors !== undefined && (
                <span>Competitors: <strong>{String(phase.result.competitors)}</strong></span>
              )}
              {phase.result.updated !== undefined && (
                <span>Updated: <strong>{String(phase.result.updated)}</strong></span>
              )}
              {phase.result.skipped !== undefined && (
                <span>Skipped (dupes): <strong>{String(phase.result.skipped)}</strong></span>
              )}
              {phase.result.promptsUpdated !== undefined && (
                <span className="col-span-2">
                  {String(phase.result.promptsUpdated)} AI prompts updated with your data
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs mt-1" onClick={onReset}>
              <RefreshCw className="h-3 w-3 mr-1" />Upload another file
            </Button>
          </div>
        )}

        {phase.type === 'error' && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 space-y-2">
            <p className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" />Import failed — {phase.filename}
            </p>
            <p className="text-xs text-red-700 dark:text-red-400">{phase.message}</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
              <RefreshCw className="h-3 w-3 mr-1" />Try again
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  )
}

export function ImportClient() {
  const [phases, setPhases] = useState<Record<Purpose, Phase>>({
    features: { type: 'idle' },
    competitors: { type: 'idle' },
    comparisons: { type: 'idle' },
  })
  const xhrRefs = useRef<Partial<Record<Purpose, XMLHttpRequest>>>({})

  const setPhase = useCallback((purpose: Purpose, phase: Phase) => {
    setPhases((prev) => ({ ...prev, [purpose]: phase }))
  }, [])

  const handleDrop = useCallback((purpose: Purpose, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const filename = file.name
    setPhase(purpose, { type: 'uploading', progress: 0, filename })

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhrRefs.current[purpose] = xhr

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        setPhase(purpose, { type: 'uploading', progress: pct, filename })
      }
    })

    xhr.addEventListener('load', () => {
      delete xhrRefs.current[purpose]
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          setPhase(purpose, { type: 'uploaded', filename, stageKey: data.stageKey, ext: data.ext ?? ext })
        } catch {
          setPhase(purpose, { type: 'error', filename, message: 'Server response was invalid' })
        }
      } else {
        let msg = 'Upload failed'
        try { msg = JSON.parse(xhr.responseText).error ?? msg } catch { /* empty */ }
        setPhase(purpose, { type: 'error', filename, message: msg })
        toast.error(msg)
      }
    })

    xhr.addEventListener('error', () => {
      delete xhrRefs.current[purpose]
      setPhase(purpose, { type: 'error', filename, message: 'Network error during upload' })
      toast.error('Network error during upload')
    })

    xhr.addEventListener('abort', () => {
      delete xhrRefs.current[purpose]
      setPhase(purpose, { type: 'idle' })
      toast('Upload cancelled')
    })

    xhr.open('POST', '/api/ingest/stage')
    xhr.send(formData)
  }, [setPhase])

  const handleCancel = useCallback((purpose: Purpose) => {
    xhrRefs.current[purpose]?.abort()
  }, [])

  const handleParse = useCallback(async (purpose: Purpose) => {
    const phase = phases[purpose]
    if (phase.type !== 'uploaded') return

    const { filename, stageKey, ext } = phase
    setPhase(purpose, { type: 'parsing', filename })

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageKey, ext, filename, purpose }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPhase(purpose, { type: 'error', filename, message: data.error ?? 'Parse failed' })
        toast.error(data.error ?? 'Parse failed')
      } else {
        setPhase(purpose, { type: 'success', filename, result: data })
        toast.success(`${CONFIGS.find((c) => c.purpose === purpose)!.title} imported!`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error'
      setPhase(purpose, { type: 'error', filename, message: msg })
      toast.error(msg)
    }
  }, [phases, setPhase])

  const handleReset = useCallback((purpose: Purpose) => {
    setPhase(purpose, { type: 'idle' })
  }, [setPhase])

  const allDone = Object.values(phases).every((p) => p.type === 'success')

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload documents to automatically populate the platform with product intelligence.
        </p>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-blue-700 dark:text-blue-300">
          <p className="text-sm font-medium">Two-step: Upload then Parse</p>
          <p className="text-xs mt-0.5">
            Drop a file to upload it — you will see live progress and can cancel. Once uploaded,
            click "Parse and Import" to extract and store the data. AI prompts update automatically after each import.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {CONFIGS.map((config) => (
          <UploadZone
            key={config.purpose}
            config={config}
            phase={phases[config.purpose]}
            onDrop={(file) => handleDrop(config.purpose, file)}
            onCancel={() => handleCancel(config.purpose)}
            onParse={() => handleParse(config.purpose)}
            onReset={() => handleReset(config.purpose)}
          />
        ))}
      </div>

      {allDone && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800 dark:text-green-300">All documents imported!</p>
          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
            AI prompts have been updated with your real product intelligence.
          </p>
          <div className="flex gap-2 justify-center mt-3">
            <Button size="sm" variant="outline" asChild><a href="/features">Features</a></Button>
            <Button size="sm" variant="outline" asChild><a href="/competitors">Competitors</a></Button>
            <Button size="sm" variant="outline" asChild><a href="/comparisons">Comparisons</a></Button>
          </div>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
          Expected file formats
        </summary>
        <div className="mt-3 space-y-3 text-xs text-muted-foreground pl-2 border-l-2">
          <div>
            <p className="font-medium text-foreground">Feature List PDF</p>
            <p>Numbered or bulleted list. Category headings in ALL CAPS or ending with colon.</p>
            <pre className="bg-muted rounded p-2 mt-1">{`CORE FEATURES:
1. Ticket Management - Create and track support tickets
2. Auto-routing - Intelligent routing

ADVANCED:
• AI Summarization
• SLA Tracking`}</pre>
          </div>
          <div>
            <p className="font-medium text-foreground">Competitive Analysis XLSX</p>
            <p>
              Option A: Each sheet = one competitor, rows = features with name/description columns.
              Option B: Matrix with features in first column and competitor names as headers.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Roadmap Comparison XLSX</p>
            <p>Matrix: first column = our features, column headers = competitor names, cells = Ahead/Behind/Partial.</p>
          </div>
        </div>
      </details>
    </div>
  )
}
