'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ItemDetailPanel } from '@/components/roadmap/ItemDetailPanel'
import { ImportDialog } from '@/components/roadmap/ImportDialog'
import { CreateItemDialog } from '@/components/roadmap/CreateItemDialog'
import { JiraTicketDrawer } from '@/components/roadmap/JiraTicketDrawer'
import {
  CategoryManager,
  CATEGORY_COLOR_PALETTE,
  getCategoryBadgeClasses,
  autoAssignColor,
} from '@/components/roadmap/CategoryManager'
import { computeRICEScore } from '@/lib/utils'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader'

import {
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Github,
  Lightbulb,
  Link2,
  Loader2,
  Map,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoadmapItem = {
  id: string
  productId: string
  title: string
  description: string
  category: string
  sourceType: string
  status: string
  priorityScore: number
  riceReach: number
  riceImpact: number
  riceConfidence: number
  riceEffort: number
  targetQuarter: string | null
  jiraKey?: string | null
  jiraStatus?: string | null
  jiraLastSyncAt?: string | null
  specStatus: string
  notes: string
  isDraft: boolean
  duplicatedFromId?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  spec: { id: string; version: number; lifecycleState: string } | null
  // Prototype fields (may be absent on older rows — treat as optional)
  prototypeStatus?: string | null
  lovableProjectUrl?: string | null
  githubRepoUrl?: string | null
  githubBranch?: string | null
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; variant: 'secondary' | 'info' | 'warning' | 'success' | 'outline' }> = {
  PROPOSED:    { label: 'Proposed',    variant: 'secondary' },
  APPROVED:    { label: 'Approved',    variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SHIPPED:     { label: 'Shipped',     variant: 'success' },
  DEFERRED:    { label: 'Deferred',    variant: 'outline' },
  BACKLOG:     { label: 'Backlog',     variant: 'secondary' },
}

const SPEC_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NO_SPEC:       { label: 'No Spec',       className: 'bg-muted text-muted-foreground border-muted' },
  DRAFT:         { label: 'Draft',         className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  UNDER_REVIEW:  { label: 'Under Review',  className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  APPROVED:      { label: 'Approved',      className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  NEEDS_REVISION:{ label: 'Needs Revision',className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
  ARCHIVED:      { label: 'Archived',      className: 'bg-muted text-muted-foreground border-muted' },
}

const LIFECYCLE_LABELS: Record<string, string> = {
  DRAFT:          'Draft',
  IN_REVIEW:      'In Review',
  APPROVED:       'Approved',
  NEEDS_REVISION: 'Needs Revision',
  ARCHIVED:       'Archived',
}

const ALL_STATUSES = ['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'SHIPPED', 'DEFERRED', 'BACKLOG']

// Timeframe
type TimeframeType = 'quarter' | 'month' | 'date' | 'range' | 'backlog' | 'none'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const QUARTERS = ['Q1','Q2','Q3','Q4']
const CUR_YEAR = new Date().getFullYear()
const YEARS = [CUR_YEAR - 1, CUR_YEAR, CUR_YEAR + 1, CUR_YEAR + 2]

function detectTimeframeType(val: string | null): TimeframeType {
  if (!val) return 'none'
  if (val === 'Backlog') return 'backlog'
  if (/^Q[1-4]\s+\d{4}$/.test(val)) return 'quarter'
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'date'
  const parts = val.split(/[-–]/)
  if (parts.length >= 2 && parts[0].trim() !== parts[1]?.trim()) return 'range'
  if (/^[A-Za-z]+ \d{4}$/.test(val)) return 'month'
  return 'quarter'
}

// ---------------------------------------------------------------------------
// useCategoryColors — localStorage-backed category color map
// ---------------------------------------------------------------------------

const COLOR_STORAGE_KEY = 'roadmap_category_colors_v1'

function useCategoryColors(allCats: string[]) {
  const [stored, setStored] = React.useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY) ?? '{}') } catch { return {} }
  })

  const updateColor = React.useCallback((cat: string, color: string) => {
    setStored((prev) => {
      const next = { ...prev, [cat]: color }
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const colors = React.useMemo(() => {
    const result: Record<string, string> = {}
    allCats.forEach((cat, idx) => {
      result[cat] = stored[cat] ?? CATEGORY_COLOR_PALETTE[idx % (CATEGORY_COLOR_PALETTE.length - 1)].value
    })
    return result
  }, [stored, allCats])

  return { colors, updateColor }
}

// ---------------------------------------------------------------------------
// CategoryBadge — colored pill
// ---------------------------------------------------------------------------

function CategoryBadge({ cat, colors, allCats }: { cat: string; colors: Record<string, string>; allCats: string[] }) {
  if (!cat) return <span className="text-muted-foreground text-xs">—</span>
  const color = colors[cat] ?? autoAssignColor(cat, allCats)
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      getCategoryBadgeClasses(color)
    )}>
      {cat}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SpecCell — rich spec state display
// ---------------------------------------------------------------------------

function SpecCell({ item }: { item: RoadmapItem }) {
  const { spec, specStatus } = item
  const cfg = SPEC_STATUS_CONFIG[specStatus] ?? SPEC_STATUS_CONFIG.NO_SPEC

  if (!spec) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        cfg.className
      )}>
        No Spec
      </span>
    )
  }

  const stateLabel = LIFECYCLE_LABELS[spec.lifecycleState] ?? spec.lifecycleState
  const label = `${stateLabel} v${spec.version}`

  return (
    <Link href={`/specs/${spec.id}`} onClick={(e) => e.stopPropagation()}>
      <span className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity',
        cfg.className
      )}>
        {label}
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Shared inline save helper — saves a field to the API
// ---------------------------------------------------------------------------

async function patchItem(id: string, patch: Record<string, unknown>): Promise<RoadmapItem> {
  const res = await fetch(`/api/roadmap/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Save failed')
  return res.json()
}

// ---------------------------------------------------------------------------
// InlineTitleCell
// ---------------------------------------------------------------------------

function InlineTitleCell({ item, onSaved }: { item: RoadmapItem; onSaved: (u: RoadmapItem) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(item.title)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => { setValue(item.title); setEditing(false) }

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === item.title) { cancel(); return }
    try {
      const updated = await patchItem(item.id, { title: trimmed })
      onSaved(updated)
      toast.success('Title updated')
    } catch { toast.error('Failed to update title'); cancel(); return }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="max-w-xs" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          onBlur={save}
          className="h-7 text-sm px-2 py-0"
        />
      </div>
    )
  }

  return (
    <div className="max-w-xs group" onDoubleClick={startEdit}>
      <p className="font-medium text-sm truncate leading-snug">{item.title}</p>
      {item.description && (
        <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">{item.description}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineCategoryCell
// ---------------------------------------------------------------------------

function InlineCategoryCell({
  item,
  onSaved,
  categories,
  colors,
}: {
  item: RoadmapItem
  onSaved: (u: RoadmapItem) => void
  categories: string[]
  colors: Record<string, string>
}) {
  const [open, setOpen] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const select = async (cat: string) => {
    if (cat === item.category) { setOpen(false); return }
    setSaving(true)
    try {
      const updated = await patchItem(item.id, { category: cat })
      onSaved(updated)
      setOpen(false)
    } catch { toast.error('Failed to update category') }
    finally { setSaving(false) }
  }

  const createAndSelect = () => {
    const t = newName.trim()
    if (t) { setNewName(''); select(t) }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="block"
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        >
          <CategoryBadge cat={item.category} colors={colors} allCats={categories} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 space-y-1" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground px-1 pb-0.5">Category</p>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => select(cat)}
              disabled={saving}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors',
                cat === item.category && 'bg-accent'
              )}
            >
              <CategoryBadge cat={cat} colors={colors} allCats={categories} />
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">No categories yet</p>
          )}
        </div>
        <div className="border-t pt-1.5 flex gap-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createAndSelect() }}
            placeholder="New category…"
            className="h-7 text-xs flex-1"
          />
          <Button size="icon" className="h-7 w-7 shrink-0" onClick={createAndSelect} disabled={!newName.trim() || saving}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// InlineStatusCell
// ---------------------------------------------------------------------------

function InlineStatusCell({ item, onSaved }: { item: RoadmapItem; onSaved: (u: RoadmapItem) => void }) {
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const select = async (status: string) => {
    if (status === item.status) { setOpen(false); return }
    setSaving(true)
    try {
      const updated = await patchItem(item.id, { status })
      onSaved(updated)
      setOpen(false)
    } catch { toast.error('Failed to update status') }
    finally { setSaving(false) }
  }

  const cfg = STATUS_CONFIG[item.status]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}>
          {cfg ? (
            <Badge variant={cfg.variant} className="whitespace-nowrap text-xs cursor-pointer">
              {cfg.label}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{item.status}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => select(s)}
            disabled={saving}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors',
              s === item.status && 'bg-accent font-medium'
            )}
          >
            <Badge variant={STATUS_CONFIG[s]?.variant ?? 'secondary'} className="text-xs pointer-events-none">
              {STATUS_CONFIG[s]?.label ?? s}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// InlineJiraCell — now opens the full Jira drawer on click
// ---------------------------------------------------------------------------

function InlineJiraCell({
  item,
  onSaved,
  onOpenDrawer,
}: {
  item: RoadmapItem
  onSaved: (u: RoadmapItem) => void
  onOpenDrawer: (key: string) => void
}) {
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [value, setValue] = React.useState(item.jiraKey ?? '')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => { setValue(item.jiraKey ?? '') }, [item.jiraKey])

  const save = async () => {
    const trimmed = value.trim()
    if (trimmed === (item.jiraKey ?? '')) { setPopoverOpen(false); return }
    setSaving(true)
    try {
      const updated = await patchItem(item.id, { jiraKey: trimmed || null })
      onSaved(updated)
      toast.success(trimmed ? 'Jira key linked' : 'Jira key cleared')
      setPopoverOpen(false)
    } catch { toast.error('Failed to update Jira key') }
    finally { setSaving(false) }
  }

  if (item.jiraKey) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onOpenDrawer(item.jiraKey!) }}
        className="flex flex-col gap-0.5 text-left group"
        title="Open Jira details"
      >
        <div className="flex items-center gap-1">
          <Link2 className="h-3 w-3 text-violet-500 shrink-0" />
          <span className="font-mono text-xs text-violet-700 group-hover:underline">{item.jiraKey}</span>
        </div>
        {item.jiraStatus && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-violet-200 text-violet-600">{item.jiraStatus}</Badge>
        )}
      </button>
    )
  }

  // No key yet — show a small popover to set it
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button onClick={(e) => { e.stopPropagation(); setPopoverOpen(true) }}>
          <span className="text-muted-foreground text-xs hover:text-foreground transition-colors">—</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3 space-y-2.5" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium">Link Jira Ticket</p>
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            placeholder="e.g. PROJ-123"
            className="h-7 text-xs font-mono flex-1"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={save} disabled={saving || !value.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// InlineRiceCell
// ---------------------------------------------------------------------------

function InlineRiceCell({ item, onSaved }: { item: RoadmapItem; onSaved: (u: RoadmapItem) => void }) {
  const [open, setOpen] = React.useState(false)
  const [reach, setReach] = React.useState(item.riceReach)
  const [impact, setImpact] = React.useState(item.riceImpact)
  const [conf, setConf] = React.useState(item.riceConfidence)
  const [effort, setEffort] = React.useState(item.riceEffort)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setReach(item.riceReach); setImpact(item.riceImpact)
      setConf(item.riceConfidence); setEffort(item.riceEffort)
    }
  }, [open, item])

  const preview = computeRICEScore(reach, impact, conf, effort)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await patchItem(item.id, {
        riceReach: reach, riceImpact: impact, riceConfidence: conf, riceEffort: effort,
        priorityScore: preview,
      })
      onSaved(updated)
      toast.success('RICE updated')
      setOpen(false)
    } catch { toast.error('Failed to update RICE') }
    finally { setSaving(false) }
  }

  const score = item.priorityScore

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className={cn(
            'font-mono text-sm font-semibold hover:underline underline-offset-2 transition-colors',
            score > 50 ? 'text-emerald-600' : 'text-muted-foreground'
          )}
        >
          {score}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium">RICE Score</p>
        {([
          { label: 'Reach', val: reach, set: setReach },
          { label: 'Impact ×', val: impact, set: setImpact },
          { label: 'Confidence %', val: conf, set: setConf },
          { label: 'Effort', val: effort, set: setEffort },
        ] as const).map(({ label, val, set }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
            <Input
              type="number"
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              className="h-7 text-xs flex-1"
              min={0}
            />
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">
            Score: <strong className={cn(preview > 50 ? 'text-emerald-600' : '')}>{preview}</strong>
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// InlineTimeframeCell
// ---------------------------------------------------------------------------

function InlineTimeframeCell({ item, onSaved }: { item: RoadmapItem; onSaved: (u: RoadmapItem) => void }) {
  const current = item.targetQuarter
  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState<TimeframeType>(() => detectTimeframeType(current))
  const [quarter, setQuarter] = React.useState(() => current?.split(' ')[0] ?? 'Q1')
  const [year, setYear] = React.useState(() => {
    const y = parseInt(current?.split(' ')[1] ?? String(CUR_YEAR)); return isNaN(y) ? CUR_YEAR : y
  })
  const [month, setMonth] = React.useState(() => current?.split(' ')[0] ?? 'Jan')
  const [freeText, setFreeText] = React.useState(current ?? '')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const t = detectTimeframeType(current)
      setType(t)
      if (t === 'quarter') {
        setQuarter(current?.split(' ')[0] ?? 'Q1')
        setYear(parseInt(current?.split(' ')[1] ?? String(CUR_YEAR)) || CUR_YEAR)
      } else if (t === 'month') {
        setMonth(current?.split(' ')[0] ?? 'Jan')
        setYear(parseInt(current?.split(' ')[1] ?? String(CUR_YEAR)) || CUR_YEAR)
      } else {
        setFreeText(current ?? '')
      }
    }
  }, [open, current])

  const buildValue = (): string | null => {
    if (type === 'none') return null
    if (type === 'backlog') return 'Backlog'
    if (type === 'quarter') return `${quarter} ${year}`
    if (type === 'month') return `${month} ${year}`
    if (type === 'date' || type === 'range') return freeText.trim() || null
    return null
  }

  const save = async () => {
    const val = buildValue()
    if (val === current) { setOpen(false); return }
    setSaving(true)
    try {
      const updated = await patchItem(item.id, { targetQuarter: val })
      onSaved(updated)
      setOpen(false)
    } catch { toast.error('Failed to update timeframe') }
    finally { setSaving(false) }
  }

  const preview = buildValue()

  const TYPE_LABELS: Record<TimeframeType, string> = {
    quarter: 'Quarter', month: 'Month', date: 'Date', range: 'Range', backlog: 'Backlog', none: 'None',
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          {current ? (
            <>
              <Calendar className="h-3 w-3 shrink-0" />
              {current}
            </>
          ) : '—'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        {/* Type selector */}
        <div>
          <p className="text-xs font-medium mb-1.5">Timeframe type</p>
          <div className="flex flex-wrap gap-1">
            {(['quarter','month','date','range','backlog','none'] as TimeframeType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs border transition-colors',
                  type === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent'
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Value input based on type */}
        {type === 'quarter' && (
          <div className="space-y-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-4 gap-1">
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuarter(q)}
                  className={cn('py-1.5 rounded text-xs border transition-colors',
                    quarter === q ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                  )}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {type === 'month' && (
          <div className="space-y-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-4 gap-1">
              {MONTHS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cn('py-1 rounded text-xs border transition-colors',
                    month === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                  )}
                >{m}</button>
              ))}
            </div>
          </div>
        )}

        {type === 'date' && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Specific date</p>
            <Input
              type="date"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        )}

        {type === 'range' && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date range (free text)</p>
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="e.g. Q1–Q2 2025"
              className="h-7 text-xs"
            />
          </div>
        )}

        {type === 'backlog' && (
          <p className="text-xs text-muted-foreground">This item will be marked as Backlog / no timeline.</p>
        )}

        {/* Preview + actions */}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {preview ?? <span className="italic">No timeline</span>}
          </span>
          <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Filter bar types
// ---------------------------------------------------------------------------

interface FilterState {
  categories: string[]
  statuses: string[]
  specStatuses: string[]
  timeframes: string[]
  hasJira: boolean
}
const EMPTY_FILTERS: FilterState = { categories: [], statuses: [], specStatuses: [], timeframes: [], hasJira: false }
function hasActiveFilters(f: FilterState) {
  return f.categories.length > 0 || f.statuses.length > 0 || f.specStatuses.length > 0 || f.timeframes.length > 0 || f.hasJira
}

function MultiSelectPill({
  label, options, selected, onChange,
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={selected.length > 0 ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5">
          {label}
          {selected.length > 0 && (
            <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0 text-[10px] font-semibold">{selected.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="space-y-0.5">
          {options.map((opt) => (
            <button key={opt} onClick={() => toggle(opt)}
              className={cn('flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent', selected.includes(opt) && 'bg-accent')}>
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="pointer-events-none" />
              <span className="truncate">{opt}</span>
            </button>
          ))}
          {options.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No options</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Bulk action bar
// ---------------------------------------------------------------------------

function BulkActionBar({ count, onGeneratePRDs, onChangeStatus, onDelete, onClear, isWorking }: {
  count: number; onGeneratePRDs: () => void; onChangeStatus: (s: string) => void
  onDelete: () => void; onClear: () => void; isWorking: boolean
}) {
  const [statusOpen, setStatusOpen] = React.useState(false)
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-lg">
      <span className="text-sm font-medium text-muted-foreground mr-1">{count} selected</span>
      <Separator orientation="vertical" className="h-5" />
      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={onGeneratePRDs} disabled={isWorking}>
        {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Generate PRDs
      </Button>
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" disabled={isWorking}>
            <Pencil className="h-3.5 w-3.5" />Change Status
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="center" side="top">
          <div className="space-y-0.5">
            {ALL_STATUSES.map((s) => (
              <button key={s} onClick={() => { onChangeStatus(s); setStatusOpen(false) }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors">
                {STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} disabled={isWorking}>
        <Trash2 className="h-3.5 w-3.5" />Delete
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClear} disabled={isWorking}>
        <X className="h-3.5 w-3.5" /><span className="sr-only">Clear</span>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RoadmapClient({
  initialItems,
  products,
  llmConfigs,
}: {
  initialItems: RoadmapItem[]
  products: { id: string; name: string }[]
  llmConfigs: { id: string; label: string; provider: string; defaultModel: string }[]
}) {
  const router = useRouter()

  const [items, setItems] = React.useState<RoadmapItem[]>(initialItems)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isBulkWorking, setIsBulkWorking] = React.useState(false)

  // Ideas tab
  const [activeTab, setActiveTab] = React.useState<'roadmap' | 'ideas'>('roadmap')
  const [ideas, setIdeas] = React.useState<RoadmapItem[]>([])
  const [ideasLoading, setIdeasLoading] = React.useState(false)

  async function loadIdeas() {
    setIdeasLoading(true)
    try {
      const res = await fetch('/api/roadmap?ideas=true')
      if (res.ok) setIdeas(await res.json())
    } finally {
      setIdeasLoading(false)
    }
  }

  async function convertIdea(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDraft: false }),
    })
    if (res.ok) {
      toast.success('Idea added to roadmap')
      loadIdeas()
      load()
    } else {
      toast.error('Failed to convert idea')
    }
  }

  async function dismissIdea(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissedAt: new Date().toISOString() }),
    })
    if (res.ok) { toast.success('Idea dismissed'); loadIdeas() }
    else toast.error('Failed')
  }

  React.useEffect(() => {
    if (activeTab === 'ideas') loadIdeas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Search
  const [searchInput, setSearchInput] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setSearchQuery(val), 300)
  }

  // Filters / panel state
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<RoadmapItem | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [catManagerOpen, setCatManagerOpen] = React.useState(false)

  // Jira ticket drawer
  const [jiraDrawer, setJiraDrawer] = React.useState<{ open: boolean; jiraKey: string }>({ open: false, jiraKey: '' })
  const openJiraDrawer = React.useCallback((key: string) => setJiraDrawer({ open: true, jiraKey: key }), [])

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [infiniteScroll, setInfiniteScroll] = React.useState(false)
  const [pageSize, setPageSize] = React.useState(25)

  // Category colors (localStorage-backed)
  const uniqueCategories = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items]
  )
  const { colors: categoryColors, updateColor } = useCategoryColors(uniqueCategories)

  const uniqueTimeframes = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.targetQuarter).filter((q): q is string => !!q))).sort(),
    [items]
  )

  // --------------------------------------------------------------------------
  // Filtered data
  // --------------------------------------------------------------------------
  const filteredItems = React.useMemo(() => {
    let data = items
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      data = data.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      )
    }
    if (filters.categories.length > 0) data = data.filter((i) => filters.categories.includes(i.category))
    if (filters.statuses.length > 0) data = data.filter((i) => filters.statuses.includes(i.status))
    if (filters.specStatuses.length > 0) data = data.filter((i) => filters.specStatuses.includes(i.specStatus))
    if (filters.timeframes.length > 0) data = data.filter((i) => i.targetQuarter && filters.timeframes.includes(i.targetQuarter))
    if (filters.hasJira) data = data.filter((i) => !!i.jiraKey)
    return data
  }, [items, searchQuery, filters])

  // --------------------------------------------------------------------------
  // Load / mutations
  // --------------------------------------------------------------------------
  async function load() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/roadmap')
      if (res.ok) setItems(await res.json())
    } catch { toast.error('Failed to reload items') }
    finally { setIsLoading(false) }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this roadmap item?')) return
    const res = await fetch(`/api/roadmap/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Item deleted'); load() }
    else toast.error('Failed to delete item')
  }

  async function duplicateItem(id: string) {
    const tid = toast.loading('Duplicating…')
    try {
      const res = await fetch(`/api/roadmap/${id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Item duplicated', { id: tid }); load()
    } catch { toast.error('Failed to duplicate', { id: tid }) }
  }

  async function generatePRD(item: RoadmapItem) {
    const tid = toast.loading(`Generating PRD for "${item.title}"…`)
    try {
      const res = await fetch('/api/specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmapItemId: item.id, title: item.title }),
      })
      if (!res.ok) throw new Error()
      const spec = await res.json()
      await fetch(`/api/specs/${spec.id}/generate`, { method: 'POST' })
      toast.success('Spec created', { id: tid })
      router.push(`/specs/${spec.id}`)
    } catch { toast.error('Failed to generate PRD', { id: tid }) }
  }


  // --------------------------------------------------------------------------
  // Inline save handler (stable via useCallback)
  // --------------------------------------------------------------------------
  const handleInlineSave = React.useCallback((updated: RoadmapItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }, [])

  // --------------------------------------------------------------------------
  // Category manager operations
  // --------------------------------------------------------------------------
  const handleCategoryRename = React.useCallback(async (oldName: string, newName: string) => {
    const tid = toast.loading('Renaming category…')
    try {
      const res = await fetch('/api/roadmap/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: oldName, to: newName }),
      })
      if (!res.ok) throw new Error()
      toast.success('Category renamed', { id: tid })
      load()
    } catch { toast.error('Failed to rename category', { id: tid }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryDelete = React.useCallback(async (_cat: string) => {
    // "Delete" from category manager just removes it from the known list.
    // Items keep their text. No API call needed — list auto-rebuilds from items.
    toast.success('Category removed from list')
  }, [])

  const handleCategoryCreate = React.useCallback((_name: string) => {
    // Creating a category here is just a UX anchor; actual association happens
    // when the user assigns it to an item via InlineCategoryCell.
    toast.info('Category ready — assign it to an item to activate it')
  }, [])

  // --------------------------------------------------------------------------
  // Bulk operations
  // --------------------------------------------------------------------------
  const selectedRows = React.useMemo(
    () => Object.keys(rowSelection).map((idx) => filteredItems[parseInt(idx)]).filter(Boolean),
    [rowSelection, filteredItems]
  )

  async function bulkGeneratePRDs() {
    if (!selectedRows.length) return
    setIsBulkWorking(true)
    const tid = toast.loading(`Generating PRDs for ${selectedRows.length} items…`)
    let done = 0
    for (const item of selectedRows) {
      try {
        const r = await fetch('/api/specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roadmapItemId: item.id, title: item.title }) })
        if (!r.ok) continue
        const s = await r.json()
        await fetch(`/api/specs/${s.id}/generate`, { method: 'POST' })
        done++
        toast.loading(`Generating… (${done}/${selectedRows.length})`, { id: tid })
      } catch { /* continue */ }
    }
    toast.success(`Generated ${done} PRD${done !== 1 ? 's' : ''}`, { id: tid })
    setRowSelection({}); setIsBulkWorking(false); load()
  }

  async function bulkChangeStatus(status: string) {
    if (!selectedRows.length) return
    setIsBulkWorking(true)
    const tid = toast.loading('Updating status…')
    let done = 0
    for (const item of selectedRows) {
      try {
        const r = await fetch(`/api/roadmap/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        if (r.ok) done++
      } catch { /* continue */ }
    }
    toast.success(`Updated ${done} item${done !== 1 ? 's' : ''}`, { id: tid })
    setRowSelection({}); setIsBulkWorking(false); load()
  }

  async function bulkDelete() {
    if (!selectedRows.length) return
    if (!confirm(`Delete ${selectedRows.length} items? This cannot be undone.`)) return
    setIsBulkWorking(true)
    const tid = toast.loading('Deleting…')
    let done = 0
    for (const item of selectedRows) {
      try {
        const r = await fetch(`/api/roadmap/${item.id}`, { method: 'DELETE' })
        if (r.ok) done++
      } catch { /* continue */ }
    }
    toast.success(`Deleted ${done} item${done !== 1 ? 's' : ''}`, { id: tid })
    setRowSelection({}); setIsBulkWorking(false); load()
  }

  // --------------------------------------------------------------------------
  // Columns
  // --------------------------------------------------------------------------
  const columns: ColumnDef<RoadmapItem>[] = React.useMemo(
    () => [
      // 1. Checkbox
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false, enableHiding: false, size: 40,
      },

      // 2. Title (double-click to edit)
      {
        accessorKey: 'title',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => <InlineTitleCell item={row.original} onSaved={handleInlineSave} />,
        size: 280,
      },

      // 3. Category (click to change, pencil in header opens manager)
      {
        accessorKey: 'category',
        header: () => (
          <div className="flex items-center gap-1">
            <span>Category</span>
            <button
              onClick={(e) => { e.stopPropagation(); setCatManagerOpen(true) }}
              className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Manage categories"
            >
              <Settings2 className="h-3 w-3" />
            </button>
          </div>
        ),
        cell: ({ row }) => (
          <InlineCategoryCell
            item={row.original}
            onSaved={handleInlineSave}
            categories={uniqueCategories}
            colors={categoryColors}
          />
        ),
        size: 140,
      },

      // 4. Jira (click to set key + sync)
      {
        id: 'jira',
        header: 'Jira',
        cell: ({ row }) => (
          <InlineJiraCell item={row.original} onSaved={handleInlineSave} onOpenDrawer={openJiraDrawer} />
        ),
        size: 120,
      },

      // 5. Status (click to change)
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <InlineStatusCell item={row.original} onSaved={handleInlineSave} />,
        size: 130,
      },

      // 6. RICE Score (click to edit)
      {
        accessorKey: 'priorityScore',
        header: ({ column }) => <DataTableColumnHeader column={column} title="RICE Score" />,
        cell: ({ row }) => <InlineRiceCell item={row.original} onSaved={handleInlineSave} />,
        size: 100,
      },

      // 7. Timeframe (replaces Quarter — click to pick type + value)
      {
        accessorKey: 'targetQuarter',
        header: 'Timeframe',
        cell: ({ row }) => <InlineTimeframeCell item={row.original} onSaved={handleInlineSave} />,
        size: 110,
      },

      // 8. Spec (rich state with version)
      {
        id: 'specStatus',
        header: 'Spec',
        cell: ({ row }) => <SpecCell item={row.original} />,
        size: 130,
      },

      // 9. Prototype compound status column
      {
        id: 'prototype',
        header: 'Prototype',
        cell: ({ row }) => {
          const item = row.original
          const status = item.prototypeStatus ?? null
          if (!status || status === 'NONE') return null

          const lovableUrl = item.lovableProjectUrl ?? null
          const githubUrl  = item.githubRepoUrl ?? null
          const branch     = item.githubBranch ?? null

          const PROTO_LABELS: Record<string, { label: string; pill: string }> = {
            PROMPT_GENERATED:         { label: 'Prompt Ready',      pill: 'bg-amber-100 text-amber-800 border-amber-200' },
            PROTOTYPE_GENERATED:      { label: 'Prototype Live',    pill: 'bg-teal-100 text-teal-800 border-teal-200' },
            GITHUB_LINKED:            { label: 'GitHub Linked',     pill: 'bg-blue-100 text-blue-800 border-blue-200' },
            READY_FOR_ENGINEERING:    { label: 'Ready for Eng',     pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            ENGINEERING_IN_PROGRESS:  { label: 'In Progress',       pill: 'bg-violet-100 text-violet-800 border-violet-200' },
            ENGINEERING_COMPLETE:     { label: 'Eng Complete',      pill: 'bg-green-100 text-green-800 border-green-200' },
          }

          const cfg = PROTO_LABELS[status] ?? { label: status.replace(/_/g, ' '), pill: 'bg-muted text-muted-foreground' }

          return (
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.pill)}>
                <Sparkles className="h-3 w-3" />
                {cfg.label}
              </span>
              {lovableUrl && (
                <a href={lovableUrl} target="_blank" rel="noopener noreferrer"
                  title="Open Lovable project"
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {githubUrl && (
                <a href={githubUrl} target="_blank" rel="noopener noreferrer"
                  title={branch ? `GitHub · ${branch}` : 'Open repository'}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="h-3 w-3" />
                </a>
              )}
            </div>
          )
        },
        size: 160, enableSorting: false,
      },

      // 10. Actions
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const item = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setPanelOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" />Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateItem(item.id) }}>
                  <Copy className="h-3.5 w-3.5" />Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generatePRD(item) }}>
                  <FileText className="h-3.5 w-3.5" />Generate PRD
                </DropdownMenuItem>
                {item.jiraKey && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openJiraDrawer(item.jiraKey!) }}>
                    <Link2 className="h-3.5 w-3.5" />View Jira Ticket
                  </DropdownMenuItem>
                )}

                {/* Prototype actions — shown when spec is approved or prototype exists */}
                {(item.spec?.lifecycleState === 'APPROVED' || item.prototypeStatus) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(item)
                      setPanelOpen(true)
                    }}>
                      <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      {!item.prototypeStatus ? 'Publish to Lovable' : 'View Prototype'}
                    </DropdownMenuItem>
                    {item.lovableProjectUrl && (
                      <DropdownMenuItem asChild>
                        <a href={item.lovableProjectUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5" />Open in Lovable
                        </a>
                      </DropdownMenuItem>
                    )}
                    {item.githubRepoUrl && (
                      <DropdownMenuItem asChild>
                        <a href={item.githubRepoUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}>
                          <Github className="h-3.5 w-3.5" />Open GitHub Repo
                        </a>
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        size: 48, enableSorting: false, enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uniqueCategories, categoryColors]
  )

  // --------------------------------------------------------------------------
  // Table instance
  // --------------------------------------------------------------------------
  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  React.useEffect(() => { table.setPageSize(pageSize) }, [pageSize, table])

  const totalRows = filteredItems.length
  const pageIndex = table.getState().pagination.pageIndex
  const currentPageSize = table.getState().pagination.pageSize
  const firstRow = pageIndex * currentPageSize + 1
  const lastRow = Math.min((pageIndex + 1) * currentPageSize, totalRows)
  const pageCount = table.getPageCount()

  const pageButtons = React.useMemo(() => {
    if (pageCount <= 5) return Array.from({ length: pageCount }, (_, i) => i)
    const cur = pageIndex
    let start = Math.max(0, cur - 2)
    const end = Math.min(pageCount - 1, start + 4)
    start = Math.max(0, end - 4)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [pageCount, pageIndex])

  const hasSelection = selectedRows.length > 0
  const activeFilters = hasActiveFilters(filters)
  const showEmptyNoItems = !isLoading && items.length === 0 && !activeFilters && !searchQuery
  const showEmptyFiltered = !isLoading && filteredItems.length === 0 && (activeFilters || searchQuery.trim() !== '')

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeTab === 'roadmap'
              ? `${items.length} item${items.length !== 1 ? 's' : ''}`
              : `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'roadmap' && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-1.5" />Import
            </Button>
          )}
          {activeTab === 'roadmap' && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />New Item
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b -mx-6 px-6">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'roadmap'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('roadmap')}
        >
          Roadmap
          <span className="ml-1.5 text-xs text-muted-foreground">({items.length})</span>
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'ideas'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('ideas')}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Ideas
          {ideas.length > 0 && (
            <span className="ml-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold px-1.5 py-0">
              {ideas.length}
            </span>
          )}
        </button>
      </div>

      {/* Ideas tab content */}
      {activeTab === 'ideas' && (
        <div>
          {ideasLoading ? (
            <div className="space-y-2 pt-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : ideas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Lightbulb className="h-12 w-12 text-yellow-300" />
              <p className="font-medium text-lg">No ideas yet</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Click <strong>New Idea</strong> in the top bar to capture rough ideas before they become roadmap items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
              {ideas.map((idea) => {
                const priority = idea.riceImpact >= 7 ? { label: 'High', cls: 'bg-red-100 text-red-700 border-red-200' }
                  : idea.riceImpact >= 4 ? { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
                  : { label: 'Low', cls: 'bg-green-100 text-green-700 border-green-200' }
                return (
                  <div key={idea.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:border-border/80 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug flex-1">{idea.title}</p>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                        onClick={() => dismissIdea(idea.id)}
                        title="Dismiss idea"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{idea.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium', priority.cls)}>
                        {priority.label}
                      </span>
                      <span className="inline-flex items-center rounded-md border bg-muted/50 px-1.5 py-0 text-xs text-muted-foreground">
                        {idea.category}
                      </span>
                    </div>
                    <Button size="sm" className="w-full gap-1.5 mt-auto" onClick={() => convertIdea(idea.id)}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Add to Roadmap
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Roadmap tab: Toolbar */}
      {activeTab === 'roadmap' && <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search roadmap..."
            className="pl-8 h-8 w-64 text-sm"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearchQuery('') }}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={filtersOpen || activeFilters ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5" />Filters
          {activeFilters && (
            <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold">
              {[filters.categories.length, filters.statuses.length, filters.specStatuses.length, filters.timeframes.length, filters.hasJira ? 1 : 0].reduce((a, b) => a + b, 0)}
            </span>
          )}
        </Button>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
          <span>Infinite scroll</span>
          <Switch checked={infiniteScroll} onCheckedChange={setInfiniteScroll} className="scale-90" />
        </div>
      </div>}

      {/* Filter bar */}
      {activeTab === 'roadmap' && filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
          <MultiSelectPill label="Category" options={uniqueCategories} selected={filters.categories} onChange={(v) => setFilters((f) => ({ ...f, categories: v }))} />
          <MultiSelectPill label="Status" options={ALL_STATUSES} selected={filters.statuses} onChange={(v) => setFilters((f) => ({ ...f, statuses: v }))} />
          <MultiSelectPill label="Spec Status" options={Object.keys(SPEC_STATUS_CONFIG)} selected={filters.specStatuses} onChange={(v) => setFilters((f) => ({ ...f, specStatuses: v }))} />
          <MultiSelectPill label="Timeframe" options={uniqueTimeframes} selected={filters.timeframes} onChange={(v) => setFilters((f) => ({ ...f, timeframes: v }))} />
          <Button variant={filters.hasJira ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setFilters((f) => ({ ...f, hasJira: !f.hasJira }))}>
            Has Jira
          </Button>
          {activeFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto gap-1.5" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="h-3.5 w-3.5" />Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {activeTab === 'roadmap' && (isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : showEmptyNoItems ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Map className="h-14 w-14 text-muted-foreground/30" />
          <div>
            <p className="font-semibold text-lg">No roadmap items yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add items manually or import from a spreadsheet.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Add Item
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-1.5" />Import
            </Button>
          </div>
        </div>
      ) : showEmptyFiltered ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">No items match your filters</p>
          <Button variant="outline" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(''); setSearchQuery('') }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <div className={cn(infiniteScroll && 'max-h-[70vh] overflow-y-auto')}>
            <Table>
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} style={{ width: header.column.getSize() }} className="text-xs">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => { setSelectedItem(row.original); setPanelOpen(true) }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {activeTab === 'roadmap' && !infiniteScroll && !showEmptyNoItems && !isLoading && filteredItems.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-sm text-muted-foreground shrink-0">
            Showing {totalRows === 0 ? 0 : firstRow}–{lastRow} of {totalRows} items
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Per page</Label>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); table.setPageIndex(0) }}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            {pageButtons.map((pg) => (
              <Button key={pg} variant={pg === pageIndex ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => table.setPageIndex(pg)}>{pg + 1}</Button>
            ))}
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-3.5 w-3.5" /></Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}><ChevronsRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {activeTab === 'roadmap' && hasSelection && (
        <BulkActionBar
          count={selectedRows.length}
          onGeneratePRDs={bulkGeneratePRDs}
          onChangeStatus={bulkChangeStatus}
          onDelete={bulkDelete}
          onClear={() => setRowSelection({})}
          isWorking={isBulkWorking}
        />
      )}

      {/* Panels & dialogs */}
      <CreateItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
        defaultProductId={products[0]?.id}
        onCreated={() => load()}
      />

      <ItemDetailPanel
        item={selectedItem as any}
        open={panelOpen}
        onOpenChange={(open) => { setPanelOpen(open); if (!open) setSelectedItem(null) }}
        onUpdate={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? (updated as any) : i)))}
        products={products}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        products={products}
        defaultProductId={products[0]?.id}
        onImportComplete={() => { setImportOpen(false); load() }}
      />

      <CategoryManager
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        categories={uniqueCategories}
        categoryColors={categoryColors}
        onUpdateColor={updateColor}
        onRename={handleCategoryRename}
        onDelete={handleCategoryDelete}
        onCreate={handleCategoryCreate}
      />

      {isBulkWorking && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-lg border bg-background px-6 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Processing bulk operation…</span>
          </div>
        </div>
      )}

      {/* Jira Ticket Drawer */}
      <JiraTicketDrawer
        open={jiraDrawer.open}
        onOpenChange={(v) => setJiraDrawer((d) => ({ ...d, open: v }))}
        jiraKey={jiraDrawer.jiraKey}
        onStatusChanged={(key, newStatus) => {
          setItems((prev) =>
            prev.map((i) => i.jiraKey === key ? { ...i, jiraStatus: newStatus } : i)
          )
        }}
      />
    </div>
  )
}
