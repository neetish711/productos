'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  X,
  ChevronRight,
  Table2,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: { id: string; name: string }[]
  defaultProductId?: string
  onImportComplete: () => void
}

type SystemField =
  | 'title'
  | 'description'
  | 'category'
  | 'status'
  | 'targetQuarter'
  | 'jiraKey'
  | 'priority'
  | 'startDate'
  | 'endDate'
  | 'storyPoints'
  | 'qaStatus'
  | 'riceReach'
  | 'riceImpact'
  | 'riceConfidence'
  | 'riceEffort'
  | 'ignore'

const SYSTEM_FIELD_LABELS: Record<SystemField, string> = {
  title: 'Title',
  description: 'Description',
  category: 'Category',
  status: 'Status',
  targetQuarter: 'Target Quarter',
  jiraKey: 'Jira Key',
  priority: 'Priority',
  startDate: 'Start Date',
  endDate: 'End Date',
  storyPoints: 'Story Points',
  qaStatus: 'QA Status',
  riceReach: 'RICE Reach',
  riceImpact: 'RICE Impact',
  riceConfidence: 'RICE Confidence',
  riceEffort: 'RICE Effort',
  ignore: '— Ignore —',
}

const ALL_SYSTEM_FIELDS: SystemField[] = [
  'title',
  'description',
  'category',
  'status',
  'targetQuarter',
  'jiraKey',
  'priority',
  'startDate',
  'endDate',
  'storyPoints',
  'qaStatus',
  'riceReach',
  'riceImpact',
  'riceConfidence',
  'riceEffort',
  'ignore',
]

type WizardState =
  | 'upload'
  | 'sheet-picker'   // Excel multi-sheet only
  | 'sheet-preview'  // Header row + extraction intent
  | 'column-mapping'
  | 'row-review'
  | 'done'

interface SheetInfo {
  name: string
  rowCount: number
  colCount: number
}

interface ParsedResult {
  fileType: string
  sheetName?: string
  sheetNames?: string[]
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string>
  headerRowIndex: number
  previewRows: string[][]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ steps, currentIdx }: { steps: string[]; currentIdx: number }) {
  return (
    <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1">
      {steps.map((label, idx) => {
        const isCompleted = idx < currentIdx
        const isCurrent = idx === currentIdx
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
              </span>
              <span
                className={cn(
                  'text-xs',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground mx-1 shrink-0" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Upload
// ---------------------------------------------------------------------------
function UploadStep({
  file,
  onFileChange,
  onNext,
  isParsing,
}: {
  file: File | null
  onFileChange: (f: File | null) => void
  onNext: () => void
  isParsing: boolean
}) {
  const onDrop = useCallback(
    (accepted: File[]) => { if (accepted.length > 0) onFileChange(accepted[0]) },
    [onFileChange]
  )
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled: isParsing,
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
          isParsing && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <>
            <FileText className="h-10 w-10 text-primary mb-3" />
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFileChange(null) }}
              className="absolute top-3 right-3 rounded-sm opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove</span>
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-sm">
              {isDragActive ? 'Drop your file here' : 'Drag & drop a file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse — CSV, XLSX, XLS, PDF
            </p>
          </>
        )}
      </div>

      {file && file.name.toLowerCase().endsWith('.pdf') && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">PDF Upload Notice</p>
              <p className="text-xs text-amber-700">
                PDF uploads are supported, but roadmap extraction works best when the data is available
                in a structured tabular format. For best results, please upload a CSV file or ensure
                your PDF contains a clear table.
              </p>
              <p className="text-xs text-amber-600">
                CSV files provide more accurate extraction for roadmap items, timelines, owners,
                priorities, and statuses.
              </p>
            </div>
          </div>
        </div>
      )}

      {file && (
        <Button onClick={onNext} disabled={isParsing} className="w-full">
          {isParsing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Detecting file…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" />Continue</>
          )}
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Sheet Picker (Excel multi-sheet)
// ---------------------------------------------------------------------------
function SheetPickerStep({
  sheets,
  selected,
  onSelect,
}: {
  sheets: SheetInfo[]
  selected: string
  onSelect: (name: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This workbook has multiple sheets. Select the one you want to import from.
      </p>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {sheets.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            onClick={() => onSelect(sheet.name)}
            className={cn(
              'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50',
              selected === sheet.name && 'border-primary bg-primary/5'
            )}
          >
            <div className="flex items-center gap-3">
              <Table2
                className={cn(
                  'h-4 w-4 shrink-0',
                  selected === sheet.name ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span className="font-medium text-sm">{sheet.name}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{sheet.rowCount.toLocaleString()} rows</span>
              <span>{sheet.colCount} cols</span>
              {selected === sheet.name && <CheckCircle2 className="h-4 w-4 text-primary" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Sheet Preview — header row selection + extraction intent
// ---------------------------------------------------------------------------
const EXTRACTION_PRESETS = [
  'Feature names and descriptions',
  'RICE scores',
  'Sprint backlog with story points',
  'Release timeline with owners',
]

function SheetPreviewStep({
  previewRows,
  selectedHeaderRow,
  onHeaderRowChange,
  extractionIntent,
  onExtractionIntentChange,
  fileType,
}: {
  previewRows: string[][]
  selectedHeaderRow: number
  onHeaderRowChange: (idx: number) => void
  extractionIntent: string
  onExtractionIntentChange: (val: string) => void
  fileType: string | null
}) {
  const maxCols = previewRows.reduce((m, r) => Math.max(m, r.length), 0)
  const showPreview = previewRows.length > 0 && fileType !== 'pdf'

  return (
    <div className="space-y-5">
      {showPreview && (
        <div>
          <p className="text-sm font-medium mb-1">Confirm header row</p>
          <p className="text-xs text-muted-foreground mb-2">
            Click the row that contains your column headers.
          </p>
          <div className="rounded-md border overflow-x-auto text-xs" style={{ maxHeight: 220 }}>
            <table className="w-full">
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onHeaderRowChange(i)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedHeaderRow === i
                        ? 'bg-primary/10 border-l-2 border-l-primary font-semibold'
                        : 'hover:bg-muted/40 border-t'
                    )}
                  >
                    <td className="px-2 py-1.5 text-muted-foreground w-10 text-center select-none">
                      {selectedHeaderRow === i ? (
                        <Badge variant="default" className="text-[9px] px-1 py-0 leading-tight">
                          HDR
                        </Badge>
                      ) : (
                        <span className="text-[10px]">{i + 1}</span>
                      )}
                    </td>
                    {Array.from({ length: maxCols }).map((_, j) => (
                      <td
                        key={j}
                        className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate"
                      >
                        {row[j] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Header: Row {selectedHeaderRow + 1}
          </p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium mb-1">
          What do you want to extract?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Describe the data you want to import — helps with column mapping suggestions.
        </p>
        <Textarea
          placeholder="e.g. Feature names, statuses, story points, and Jira tickets"
          value={extractionIntent}
          onChange={(e) => onExtractionIntentChange(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {EXTRACTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onExtractionIntentChange(preset)}
              className="text-xs rounded-full border px-2.5 py-0.5 hover:bg-muted transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Column Mapping (include/exclude + field assignment)
// ---------------------------------------------------------------------------
function ColumnMappingStep({
  headers,
  columnIncludes,
  onToggleInclude,
  onSelectAll,
  onSelectMappedOnly,
  mapping,
  onMappingChange,
  previewRows,
  selectedHeaderRow,
}: {
  headers: string[]
  columnIncludes: Record<string, boolean>
  onToggleInclude: (header: string) => void
  onSelectAll: () => void
  onSelectMappedOnly: () => void
  mapping: Record<string, SystemField>
  onMappingChange: (header: string, field: SystemField) => void
  previewRows: string[][]
  selectedHeaderRow: number
}) {
  // Raw header row from preview (used to find column position for sample values)
  const rawHeaderRow = previewRows[selectedHeaderRow] ?? []
  // Data rows after the header
  const sampleDataRows = previewRows.filter((_, i) => i > selectedHeaderRow).slice(0, 3)

  const getSamples = (header: string): string => {
    const colIdx = rawHeaderRow.indexOf(header)
    if (colIdx === -1) return '—'
    const vals = sampleDataRows
      .map(r => r[colIdx] ?? '')
      .filter(Boolean)
      .slice(0, 2)
    return vals.length > 0 ? vals.join(' · ') : '—'
  }

  const includedCount = headers.filter(h => columnIncludes[h] !== false).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground shrink-0">
          Map columns to system fields. <strong>Title</strong> is required.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{includedCount} / {headers.length} included</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectMappedOnly}>
            Keep mapped only
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll}>
            Select all
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-y-auto" style={{ maxHeight: 380 }}>
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-2 py-2 w-8 text-center font-medium">Inc</th>
              <th className="px-3 py-2 text-left font-medium">Column</th>
              <th className="px-3 py-2 text-left font-medium">Map to field</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Samples</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header) => {
              const included = columnIncludes[header] !== false
              return (
                <tr key={header} className={cn('border-t', !included && 'opacity-40')}>
                  <td className="px-2 py-2 text-center">
                    <Checkbox
                      checked={included}
                      onCheckedChange={() => onToggleInclude(header)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <span className="block truncate max-w-[140px]">{header}</span>
                  </td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <Select
                      value={(mapping[header] as string) ?? 'ignore'}
                      onValueChange={(val) => onMappingChange(header, val as SystemField)}
                      disabled={!included}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_SYSTEM_FIELDS.map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {SYSTEM_FIELD_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="block truncate max-w-[160px]">{getSamples(header)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Row Review
// ---------------------------------------------------------------------------
function ReviewRowsStep({
  parsed,
  mapping,
  columnIncludes,
  selectedRows,
  onToggleRow,
  onSelectAll,
  onDeselectAll,
}: {
  parsed: ParsedResult
  mapping: Record<string, SystemField>
  columnIncludes: Record<string, boolean>
  selectedRows: Set<number>
  onToggleRow: (idx: number) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  const fieldToHeader: Partial<Record<SystemField, string>> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'ignore' && columnIncludes[header] !== false) {
      fieldToHeader[field as SystemField] = header
    }
  }
  const getVal = (row: Record<string, string>, field: SystemField) => {
    const h = fieldToHeader[field]
    return h ? (row[h] ?? '') : ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedRows.size} of {parsed.rows.length} rows selected for import
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDeselectAll}>
            Deselect all
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-auto" style={{ maxHeight: 360 }}>
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Quarter</th>
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, i) => (
              <tr
                key={i}
                className={cn('border-t transition-colors', !selectedRows.has(i) && 'opacity-40')}
              >
                <td className="px-3 py-2 text-center">
                  <Checkbox
                    checked={selectedRows.has(i)}
                    onCheckedChange={() => onToggleRow(i)}
                    aria-label={`Row ${i + 1}`}
                  />
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate font-medium">
                  {getVal(row, 'title')}
                </td>
                <td className="px-3 py-2 max-w-[120px] truncate text-muted-foreground">
                  {getVal(row, 'category')}
                </td>
                <td className="px-3 py-2 max-w-[100px] truncate text-muted-foreground">
                  {getVal(row, 'status')}
                </td>
                <td className="px-3 py-2 max-w-[100px] truncate text-muted-foreground">
                  {getVal(row, 'targetQuarter')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step: Done
// ---------------------------------------------------------------------------
function DoneStep({ importCount }: { importCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <CheckCircle2 className="h-14 w-14 text-green-500" />
      <div>
        <p className="text-xl font-semibold">Import complete!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Successfully imported{' '}
          <span className="font-medium text-foreground">{importCount}</span> roadmap item
          {importCount !== 1 ? 's' : ''}.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ImportDialog({
  open,
  onOpenChange,
  products,
  defaultProductId,
  onImportComplete,
}: ImportDialogProps) {
  const [wizardState, setWizardState] = useState<WizardState>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const [detectedSheets, setDetectedSheets] = useState<SheetInfo[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [selectedHeaderRow, setSelectedHeaderRow] = useState(0)
  const [extractionIntent, setExtractionIntent] = useState('')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [columnIncludes, setColumnIncludes] = useState<Record<string, boolean>>({})
  const [mapping, setMapping] = useState<Record<string, SystemField>>({})
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [importCount, setImportCount] = useState(0)
  const [productId, setProductId] = useState(defaultProductId ?? products[0]?.id ?? '')
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const isExcelFile = (f: File | null) => {
    const ext = f?.name.split('.').pop()?.toLowerCase()
    return ext === 'xlsx' || ext === 'xls'
  }

  const isMultiSheet = isExcelFile(file) && detectedSheets.length > 1

  const steps = isMultiSheet
    ? ['Upload', 'Sheet', 'Preview', 'Map', 'Review', 'Done']
    : ['Upload', 'Preview', 'Map', 'Review', 'Done']

  const stateToIdx: Record<WizardState, number> = isMultiSheet
    ? { upload: 0, 'sheet-picker': 1, 'sheet-preview': 2, 'column-mapping': 3, 'row-review': 4, done: 5 }
    : { upload: 0, 'sheet-picker': 0, 'sheet-preview': 1, 'column-mapping': 2, 'row-review': 3, done: 4 }

  const reset = () => {
    setWizardState('upload')
    setFile(null)
    setFileType(null)
    setDetectedSheets([])
    setSelectedSheet('')
    setPreviewRows([])
    setSelectedHeaderRow(0)
    setExtractionIntent('')
    setParsed(null)
    setColumnIncludes({})
    setMapping({})
    setSelectedRows(new Set())
    setImportCount(0)
    setProductId(defaultProductId ?? products[0]?.id ?? '')
  }

  const handleOpenChange = (val: boolean) => {
    if (!val) reset()
    onOpenChange(val)
  }

  // Parse a specific sheet (or auto for CSV/PDF)
  const applyParseResult = (data: ParsedResult) => {
    setFileType(data.fileType)
    setParsed(data)
    const mapping = data.suggestedMapping as Record<string, SystemField>
    setMapping(mapping)
    // Only pre-select columns that have a confident mapping; deselect the rest
    const includes: Record<string, boolean> = {}
    data.headers.forEach(h => { includes[h] = h in mapping })
    setColumnIncludes(includes)
    setSelectedRows(new Set(data.rows.map((_, i) => i)))
    if (data.previewRows?.length) setPreviewRows(data.previewRows)
  }

  const parseSheet = async (sheetName?: string, headerRow = 0): Promise<boolean> => {
    if (!file) return false
    setIsParsing(true)
    try {
      const params = new URLSearchParams()
      if (sheetName) params.set('sheet', sheetName)
      if (headerRow > 0) params.set('headerRow', String(headerRow))
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/roadmap/parse-file?${params}`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Parse failed')
      const data: ParsedResult = await res.json()
      applyParseResult(data)
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file')
      return false
    } finally {
      setIsParsing(false)
    }
  }

  // Step 1: Upload → Continue
  const handleUploadNext = async () => {
    if (!file) return
    if (isExcelFile(file)) {
      // Detect sheets first (no row parsing)
      setIsParsing(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/roadmap/parse-file?mode=detect', { method: 'POST', body: formData })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Detection failed')
        const data = await res.json()
        const sheets: SheetInfo[] = data.sheets ?? []
        setDetectedSheets(sheets)
        setFileType('xlsx')

        if (sheets.length > 1) {
          // Multiple sheets — let user pick
          setSelectedSheet(sheets[0].name)
          setIsParsing(false)
          setWizardState('sheet-picker')
        } else {
          // Single sheet — auto-select, parse immediately
          const singleSheet = sheets[0]?.name ?? ''
          setSelectedSheet(singleSheet)
          setIsParsing(false)
          const ok = await parseSheet(singleSheet, 0)
          if (ok) setWizardState('sheet-preview')
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to read workbook')
        setIsParsing(false)
      }
    } else {
      // CSV / PDF — parse directly
      const ok = await parseSheet(undefined, 0)
      if (ok) setWizardState('sheet-preview')
    }
  }

  // Step 2: Sheet picker → Next
  const handleSheetPickerNext = async () => {
    const ok = await parseSheet(selectedSheet, 0)
    if (ok) {
      setSelectedHeaderRow(0)
      setWizardState('sheet-preview')
    }
  }

  // Step 3: Sheet preview → Next
  const handleSheetPreviewNext = async () => {
    if (selectedHeaderRow !== (parsed?.headerRowIndex ?? 0)) {
      // Re-parse with the user-selected header row
      const ok = await parseSheet(selectedSheet || undefined, selectedHeaderRow)
      if (!ok) return
    }
    setWizardState('column-mapping')
  }

  // Step 4: Column mapping → Next
  const handleColumnMappingNext = () => {
    setWizardState('row-review')
  }

  // Step 5: Row review → Import
  const handleImport = async () => {
    if (!parsed) return
    setIsImporting(true)

    const fieldToHeader: Partial<Record<SystemField, string>> = {}
    for (const [header, field] of Object.entries(mapping)) {
      if (field !== 'ignore' && columnIncludes[header] !== false) {
        fieldToHeader[field as SystemField] = header
      }
    }
    const getVal = (row: Record<string, string>, field: SystemField) => {
      const h = fieldToHeader[field]
      return h ? (row[h] ?? '') : ''
    }

    const rows = Array.from(selectedRows)
      .sort((a, b) => a - b)
      .map((idx) => {
        const row = parsed.rows[idx]
        return {
          title: getVal(row, 'title'),
          description: getVal(row, 'description'),
          category: getVal(row, 'category') || 'General',
          status: getVal(row, 'status') || 'PROPOSED',
          targetQuarter: getVal(row, 'targetQuarter'),
          jiraKey: getVal(row, 'jiraKey'),
          riceReach: getVal(row, 'riceReach') ? Number(getVal(row, 'riceReach')) : undefined,
          riceImpact: getVal(row, 'riceImpact') ? Number(getVal(row, 'riceImpact')) : undefined,
          riceConfidence: getVal(row, 'riceConfidence') ? Number(getVal(row, 'riceConfidence')) : undefined,
          riceEffort: getVal(row, 'riceEffort') ? Number(getVal(row, 'riceEffort')) : undefined,
        }
      })

    try {
      const res = await fetch('/api/roadmap/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rows }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Import failed')
      const data = await res.json()
      setImportCount(data.imported ?? rows.length)
      setWizardState('done')
      onImportComplete()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const handleBack = () => {
    if (wizardState === 'sheet-picker') setWizardState('upload')
    else if (wizardState === 'sheet-preview') {
      setWizardState(isMultiSheet ? 'sheet-picker' : 'upload')
    }
    else if (wizardState === 'column-mapping') setWizardState('sheet-preview')
    else if (wizardState === 'row-review') setWizardState('column-mapping')
  }

  const hasTitleMapped = Object.entries(mapping).some(
    ([h, f]) => f === 'title' && columnIncludes[h] !== false
  )

  // Derive Next disabled state and the reason to show users
  const getNextState = (): { disabled: boolean; hint: string | null } => {
    if (isParsing) return { disabled: true, hint: 'Processing… please wait.' }
    if (wizardState === 'sheet-picker') {
      return selectedSheet ? { disabled: false, hint: null } : { disabled: true, hint: 'Select a sheet to continue.' }
    }
    if (wizardState === 'sheet-preview') {
      // Header row is always valid (defaults to 0); extraction intent is optional
      return { disabled: false, hint: null }
    }
    if (wizardState === 'column-mapping') {
      return hasTitleMapped
        ? { disabled: false, hint: null }
        : { disabled: true, hint: 'Map at least one column to Title to continue.' }
    }
    if (wizardState === 'row-review') {
      return selectedRows.size > 0
        ? { disabled: isImporting, hint: null }
        : { disabled: true, hint: 'Select at least one row to import.' }
    }
    return { disabled: false, hint: null }
  }

  const renderFooter = () => {
    if (wizardState === 'upload') {
      return (
        <div className="flex-shrink-0 flex justify-end pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
        </div>
      )
    }
    if (wizardState === 'done') {
      return (
        <div className="flex-shrink-0 flex justify-end pt-2">
          <Button onClick={() => handleOpenChange(false)}>Close</Button>
        </div>
      )
    }

    const { disabled: isNextDisabled, hint } = getNextState()
    const importLabel = `Import ${selectedRows.size} item${selectedRows.size !== 1 ? 's' : ''}`
    const nextLabel = wizardState === 'row-review' ? importLabel : 'Next'

    const onNext =
      wizardState === 'sheet-picker' ? handleSheetPickerNext
      : wizardState === 'sheet-preview' ? handleSheetPreviewNext
      : wizardState === 'column-mapping' ? handleColumnMappingNext
      : handleImport

    // Status summary for preview step (shown above footer)
    const previewStatus =
      wizardState === 'sheet-preview' && parsed ? (
        <p className="text-xs text-muted-foreground">
          Header: Row {selectedHeaderRow + 1}
          {parsed.headers.length > 0 && ` · ${parsed.headers.length} columns detected`}
          {' · '}
          <span className="text-primary">Extraction intent optional</span>
        </p>
      ) : null

    return (
      <div className="flex-shrink-0 border-t bg-background pt-3 mt-2 space-y-2">
        {previewStatus}
        {hint && (
          <p className="text-xs text-amber-600">{hint}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleBack} disabled={isParsing || isImporting}>
            Back
          </Button>
          <Button onClick={onNext} disabled={isNextDisabled}>
            {isParsing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</>
            ) : isImporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
            ) : nextLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Fixed header — never scrolls */}
        <div className="flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Import Roadmap Items</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <StepIndicator steps={steps} currentIdx={stateToIdx[wizardState]} />
          </div>

          {wizardState !== 'done' && products.length > 1 && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium w-24 shrink-0">Product</span>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Scrollable step content */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1 pr-1">
          {wizardState === 'upload' && (
            <UploadStep
              file={file}
              onFileChange={setFile}
              onNext={handleUploadNext}
              isParsing={isParsing}
            />
          )}
          {wizardState === 'sheet-picker' && (
            <SheetPickerStep
              sheets={detectedSheets}
              selected={selectedSheet}
              onSelect={setSelectedSheet}
            />
          )}
          {wizardState === 'sheet-preview' && (
            <SheetPreviewStep
              previewRows={previewRows}
              selectedHeaderRow={selectedHeaderRow}
              onHeaderRowChange={setSelectedHeaderRow}
              extractionIntent={extractionIntent}
              onExtractionIntentChange={setExtractionIntent}
              fileType={fileType}
            />
          )}
          {wizardState === 'column-mapping' && parsed && (
            <ColumnMappingStep
              headers={parsed.headers}
              columnIncludes={columnIncludes}
              onToggleInclude={(h) =>
                setColumnIncludes((prev) => ({ ...prev, [h]: !prev[h] }))
              }
              onSelectAll={() => {
                const all: Record<string, boolean> = {}
                parsed.headers.forEach(h => { all[h] = true })
                setColumnIncludes(all)
              }}
              onSelectMappedOnly={() => {
                const mapped: Record<string, boolean> = {}
                parsed.headers.forEach(h => { mapped[h] = h in mapping })
                setColumnIncludes(mapped)
              }}
              mapping={mapping}
              onMappingChange={(h, f) => setMapping((prev) => ({ ...prev, [h]: f }))}
              previewRows={previewRows}
              selectedHeaderRow={selectedHeaderRow}
            />
          )}
          {wizardState === 'row-review' && parsed && (
            <ReviewRowsStep
              parsed={parsed}
              mapping={mapping}
              columnIncludes={columnIncludes}
              selectedRows={selectedRows}
              onToggleRow={(i) =>
                setSelectedRows((prev) => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
              onSelectAll={() => setSelectedRows(new Set(parsed.rows.map((_, i) => i)))}
              onDeselectAll={() => setSelectedRows(new Set())}
            />
          )}
          {wizardState === 'done' && <DoneStep importCount={importCount} />}
        </div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  )
}
