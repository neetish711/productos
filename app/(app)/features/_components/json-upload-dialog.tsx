'use client'

import { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, FileJson, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Product } from './types'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type ParsedRecord = {
  index: number
  name: string
  category?: string
  status?: string
  build?: string
  owner?: string
  valid: boolean
  error?: string
}

type ImportResult = {
  created: number
  failed: number
  errors: { index: number; name: string; error: string }[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  products: Product[]
}

const SAMPLE_JSON = `[
  {
    "name": "AI-Powered Search",
    "description": "Semantic search using embedding models.",
    "category": "AI",
    "status": "AVAILABLE",
    "build": "v3.1",
    "owner": "Platform Team",
    "tags": ["search", "ai", "core"],
    "maturityLevel": "GA",
    "isCustomerFacing": true,
    "valueProposition": "Reduces search time by 60%.",
    "targetUsers": "End users, CSMs",
    "docsLinks": [{ "label": "Docs", "url": "https://docs.example.com/search" }],
    "introducedInBuild": "v2.8",
    "updatedInBuild": "v3.1"
  }
]`

export function JsonUploadDialog({ open, onClose, onSuccess, products }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<ParsedRecord[] | null>(null)
  const [rawRecords, setRawRecords] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showSample, setShowSample] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setParsed(null)
    setRawRecords([])
    setFileName('')
    setParseError('')
    setResult(null)
    setShowSample(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const processFile = useCallback((file: File) => {
    setParseError('')
    setParsed(null)
    setResult(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const records: any[] = Array.isArray(json) ? json : [json]
        setRawRecords(records)
        const preview: ParsedRecord[] = records.map((r, i) => {
          if (!r || typeof r !== 'object') {
            return { index: i, name: `Row ${i + 1}`, valid: false, error: 'Not an object' }
          }
          if (!r.name || typeof r.name !== 'string' || r.name.trim() === '') {
            return { index: i, name: `Row ${i + 1}`, valid: false, error: '"name" field is required' }
          }
          return {
            index: i,
            name: r.name,
            category: r.category,
            status: r.status,
            build: r.build,
            owner: r.owner,
            valid: true,
          }
        })
        setParsed(preview)
      } catch {
        setParseError('Invalid JSON. Please check your file and try again.')
      }
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const validCount = parsed?.filter((r) => r.valid).length ?? 0
  const invalidCount = parsed?.filter((r) => !r.valid).length ?? 0

  const handleImport = async () => {
    if (!parsed || validCount === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/features/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: rawRecords,
          productId: selectedProductId || undefined,
        }),
      })
      const data: ImportResult = await res.json()
      setResult(data)
      if (data.created > 0) onSuccess()
    } catch {
      setResult({ created: 0, failed: validCount, errors: [{ index: 0, name: '', error: 'Network error' }] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" /> Upload Features from JSON
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Result state */}
          {result ? (
            <div className="space-y-3">
              <div className={`rounded-lg p-4 flex items-start gap-3 ${result.failed === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                {result.failed === 0
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                }
                <div>
                  <p className="font-medium text-sm">
                    {result.created} feature{result.created !== 1 ? 's' : ''} imported successfully
                    {result.failed > 0 && `, ${result.failed} failed`}
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {result.errors.map((e, i) => (
                        <li key={i} className="text-xs text-amber-800">
                          <span className="font-medium">{e.name}</span>: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Product selector */}
              {products.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm shrink-0">Import into:</span>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Drop zone */}
              {!parsed && (
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                    ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onFileChange} />
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Drop your JSON file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Accepts .json — array of feature objects</p>
                </div>
              )}

              {/* Parse error */}
              {parseError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {parseError}
                  <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={reset}>Try again</Button>
                </div>
              )}

              {/* Preview table */}
              {parsed && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fileName}</span>
                      <Badge variant="outline">{parsed.length} rows</Badge>
                      {validCount > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-0">{validCount} valid</Badge>
                      )}
                      {invalidCount > 0 && (
                        <Badge className="bg-red-100 text-red-800 border-0">{invalidCount} invalid</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>Change file</Button>
                  </div>
                  <ScrollArea className="h-52 rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Name</th>
                          <th className="text-left px-3 py-2 font-medium">Category</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-left px-3 py-2 font-medium">Build</th>
                          <th className="text-left px-3 py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.map((r) => (
                          <tr key={r.index} className={`border-t ${r.valid ? '' : 'bg-red-50'}`}>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.index + 1}</td>
                            <td className="px-3 py-1.5 font-medium max-w-[180px] truncate">{r.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.category ?? '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.status ?? '—'}</td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.build ?? '—'}</td>
                            <td className="px-3 py-1.5">
                              {r.valid
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                : (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-3.5 w-3.5" />
                                    {r.error}
                                  </span>
                                )
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Sample schema toggle */}
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowSample((v) => !v)}
              >
                {showSample ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                View example JSON schema
              </button>
              {showSample && (
                <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-48 leading-relaxed">
                  {SAMPLE_JSON}
                </pre>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!parsed || validCount === 0 || importing}
              >
                {importing ? 'Importing…' : `Import ${validCount} Feature${validCount !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
