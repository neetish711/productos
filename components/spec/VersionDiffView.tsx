'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import {
  X, Plus, Minus, ArrowRight, GitCompare, ChevronDown,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  Clipboard, Columns2, AlignJustify,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  computeLineDiff,
  getDiffStats,
  collapseUnchanged,
  getSectionChanges,
  buildSideBySidePairs,
  buildSideBySideChunks,
  type DiffLine,
  type DiffChunk,
  type SideBySideChunk,
} from '@/lib/diff'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VersionOption {
  id: string
  version: number
  versionName?: string | null
  contentMd: string
  createdAt: string
  changeSummary?: string | null
  generationMode?: string
}

interface VersionDiffViewProps {
  open: boolean
  onClose: () => void
  versions: VersionOption[]
  initialFromId: string
  initialToId: string
}

type DiffMode = 'split' | 'unified'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function versionLabel(v: VersionOption) {
  return `v${v.version}${v.versionName ? ` · ${v.versionName}` : ''}`
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  )
}

// ---------------------------------------------------------------------------
// Section status badge
// ---------------------------------------------------------------------------

function SectionStatusBadge({ status }: { status: string }) {
  if (status === 'added')
    return <span className="text-[10px] font-medium px-1.5 py-0 rounded border bg-green-50 text-green-700 border-green-200">added</span>
  if (status === 'removed')
    return <span className="text-[10px] font-medium px-1.5 py-0 rounded border bg-red-50 text-red-700 border-red-200">removed</span>
  if (status === 'modified')
    return <span className="text-[10px] font-medium px-1.5 py-0 rounded border bg-amber-50 text-amber-700 border-amber-200">modified</span>
  return null
}

// ---------------------------------------------------------------------------
// Side-by-side split view
// ---------------------------------------------------------------------------

interface SplitViewProps {
  diff: DiffLine[]
  fromVersion: VersionOption
  toVersion: VersionOption
  showAllContext: boolean
  onExpandAll: () => void
  scrollRef: React.RefObject<HTMLDivElement>
}

function SplitView({ diff, fromVersion, toVersion, showAllContext, onExpandAll, scrollRef }: SplitViewProps) {
  const pairs = useMemo(() => buildSideBySidePairs(diff), [diff])
  const chunks: SideBySideChunk[] = useMemo(
    () => showAllContext ? [{ type: 'visible', pairs }] : buildSideBySideChunks(pairs, 3),
    [pairs, showAllContext],
  )

  const items: React.ReactNode[] = []
  let changeBlockCount = 0

  chunks.forEach((chunk, ci) => {
    if (chunk.type === 'collapsed') {
      items.push(
        <div
          key={`col-${ci}`}
          className="col-span-2 flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-y border-border/40 text-muted-foreground text-[11px] cursor-pointer hover:bg-muted/50"
          onClick={onExpandAll}
        >
          <span className="text-primary font-medium">↕ {chunk.count} unchanged line{chunk.count !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground/60">click to expand</span>
        </div>,
      )
      return
    }

    let prevWasChange = false
    chunk.pairs.forEach((pair, pi) => {
      const isSameLine = pair.left !== null && pair.right !== null && pair.left.type === 'same'
      const isChange = !isSameLine
      const isFirstInBlock = isChange && !prevWasChange
      prevWasChange = isChange

      const blockAttr = isFirstInBlock ? { 'data-change-block': String(changeBlockCount++) } : {}

      if (isSameLine && pair.left && pair.right) {
        items.push(
          <div key={`${ci}-${pi}-l`} className="flex items-start border-r hover:bg-muted/20" {...blockAttr}>
            <span className="w-9 shrink-0 text-right pr-2 py-0.5 select-none text-[10px] text-muted-foreground/30 border-r border-border/30">{pair.left.lineNumOld ?? ''}</span>
            <span className="w-4 shrink-0 py-0.5 select-none text-center text-muted-foreground/30"> </span>
            <span className="flex-1 py-0.5 pl-1 pr-2 whitespace-pre-wrap break-words text-foreground/55">{pair.left.text || '\u00a0'}</span>
          </div>,
        )
        items.push(
          <div key={`${ci}-${pi}-r`} className="flex items-start hover:bg-muted/20">
            <span className="w-9 shrink-0 text-right pr-2 py-0.5 select-none text-[10px] text-muted-foreground/30 border-r border-border/30">{pair.right.lineNumNew ?? ''}</span>
            <span className="w-4 shrink-0 py-0.5 select-none text-center text-muted-foreground/30"> </span>
            <span className="flex-1 py-0.5 pl-1 pr-2 whitespace-pre-wrap break-words text-foreground/55">{pair.right.text || '\u00a0'}</span>
          </div>,
        )
        return
      }

      // Changed pair
      const { left, right } = pair
      items.push(
        <div
          key={`${ci}-${pi}-l`}
          className={cn('flex items-start border-r group', left ? 'bg-red-50 dark:bg-red-950/25' : 'bg-muted/10')}
          {...blockAttr}
        >
          {left ? (
            <>
              <span className="w-9 shrink-0 text-right pr-2 py-0.5 select-none text-[10px] text-red-500 bg-red-100/60 dark:bg-red-900/20 border-r border-red-200/60">{left.lineNumOld ?? ''}</span>
              <span className="w-4 shrink-0 py-0.5 select-none text-center font-bold text-[11px] text-red-500">{left.type === 'removed' ? '−' : ' '}</span>
              <span className="flex-1 py-0.5 pl-1 pr-1 whitespace-pre-wrap break-words text-red-900 dark:text-red-100">{left.text || '\u00a0'}</span>
              <button
                className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity shrink-0 p-0.5 text-muted-foreground hover:text-foreground mr-0.5"
                onClick={() => copyText(left.text)}
                title="Copy this line"
              >
                <Clipboard className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex-1 min-h-[1.375rem]" />
          )}
        </div>,
      )
      items.push(
        <div
          key={`${ci}-${pi}-r`}
          className={cn('flex items-start group', right ? 'bg-green-50 dark:bg-green-950/25' : 'bg-muted/10')}
        >
          {right ? (
            <>
              <span className="w-9 shrink-0 text-right pr-2 py-0.5 select-none text-[10px] text-green-600 bg-green-100/60 dark:bg-green-900/20 border-r border-green-200/60">{right.lineNumNew ?? ''}</span>
              <span className="w-4 shrink-0 py-0.5 select-none text-center font-bold text-[11px] text-green-600">{right.type === 'added' ? '+' : ' '}</span>
              <span className="flex-1 py-0.5 pl-1 pr-1 whitespace-pre-wrap break-words text-green-900 dark:text-green-100">{right.text || '\u00a0'}</span>
              <button
                className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity shrink-0 p-0.5 text-muted-foreground hover:text-foreground mr-0.5"
                onClick={() => copyText(right.text)}
                title="Copy this line"
              >
                <Clipboard className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex-1 min-h-[1.375rem]" />
          )}
        </div>,
      )
    })
  })

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
      <div className="font-mono text-xs select-text" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* Sticky column headers */}
        <div className="sticky top-0 z-10 border-r bg-muted/40 backdrop-blur-sm px-3 py-1.5 text-[11px] text-red-600/70 truncate border-b">
          {versionLabel(fromVersion)}{fromVersion.changeSummary ? ` — ${fromVersion.changeSummary}` : ''}
        </div>
        <div className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm px-3 py-1.5 text-[11px] text-green-600/70 truncate border-b">
          {versionLabel(toVersion)}{toVersion.changeSummary ? ` — ${toVersion.changeSummary}` : ''}
        </div>
        {items}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unified diff view
// ---------------------------------------------------------------------------

interface UnifiedViewProps {
  diff: DiffLine[]
  fromVersion: VersionOption
  toVersion: VersionOption
  showAllContext: boolean
  onExpandAll: () => void
  scrollRef: React.RefObject<HTMLDivElement>
}

function UnifiedView({ diff, fromVersion, toVersion, showAllContext, onExpandAll, scrollRef }: UnifiedViewProps) {
  const chunks: DiffChunk[] = useMemo(
    () => showAllContext ? [{ type: 'visible', lines: diff }] : collapseUnchanged(diff, 3),
    [diff, showAllContext],
  )

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
      <div className="font-mono text-xs select-text">
        {/* Column headers */}
        <div className="flex border-b bg-muted/40 backdrop-blur-sm text-[11px] text-muted-foreground sticky top-0 z-10">
          <div className="w-9 shrink-0 border-r" />
          <div className="w-9 shrink-0 border-r" />
          <div className="w-4 shrink-0" />
          <div className="flex-1 flex">
            <span className="flex-1 px-2 py-1 border-r text-red-600/70 truncate">
              {versionLabel(fromVersion)}{fromVersion.changeSummary ? ` — ${fromVersion.changeSummary}` : ''}
            </span>
            <span className="flex-1 px-2 py-1 text-green-600/70 truncate">
              {versionLabel(toVersion)}{toVersion.changeSummary ? ` — ${toVersion.changeSummary}` : ''}
            </span>
          </div>
        </div>
        {chunks.map((chunk, ci) => {
          if (chunk.type === 'collapsed') {
            return (
              <div
                key={ci}
                className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-y border-border/40 text-muted-foreground text-[11px] cursor-pointer hover:bg-muted/50"
                data-change-block={undefined}
                onClick={onExpandAll}
              >
                <span className="text-primary font-medium">↕ {chunk.count} unchanged line{chunk.count !== 1 ? 's' : ''}</span>
                <span className="text-muted-foreground/60">click to expand</span>
              </div>
            )
          }
          return chunk.lines.map((line, li) => (
            <div
              key={`${ci}-${li}`}
              data-change-block={line.type !== 'same' && (li === 0 || chunk.lines[li - 1]?.type === 'same') ? 'true' : undefined}
              className={cn(
                'flex leading-5 min-h-[1.25rem] group',
                line.type === 'added' && 'bg-green-50 dark:bg-green-950/25',
                line.type === 'removed' && 'bg-red-50 dark:bg-red-950/25',
              )}
            >
              <span className={cn('w-9 shrink-0 text-right pr-2 py-0.5 select-none border-r text-[10px]', line.type === 'removed' ? 'text-red-500 bg-red-100/60 border-red-200/60' : 'text-muted-foreground/30 border-border/30')}>{line.lineNumOld ?? ''}</span>
              <span className={cn('w-9 shrink-0 text-right pr-2 py-0.5 select-none border-r text-[10px]', line.type === 'added' ? 'text-green-600 bg-green-100/60 border-green-200/60' : 'text-muted-foreground/30 border-border/30')}>{line.lineNumNew ?? ''}</span>
              <span className={cn('w-4 shrink-0 text-center py-0.5 select-none font-bold text-[11px]', line.type === 'added' && 'text-green-600', line.type === 'removed' && 'text-red-500')}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <span className={cn('flex-1 py-0.5 pl-1 pr-4 whitespace-pre-wrap break-words', line.type === 'added' && 'text-green-900 dark:text-green-100', line.type === 'removed' && 'text-red-900 dark:text-red-100', line.type === 'same' && 'text-foreground/55')}>
                {line.text || '\u00a0'}
              </span>
              {line.type !== 'same' && (
                <button
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity shrink-0 p-0.5 text-muted-foreground hover:text-foreground mr-1"
                  onClick={() => copyText(line.text)}
                  title="Copy this line"
                >
                  <Clipboard className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VersionDiffView({ open, onClose, versions, initialFromId, initialToId }: VersionDiffViewProps) {
  const [fromId, setFromId] = useState(initialFromId)
  const [toId, setToId] = useState(initialToId)
  const [mode, setMode] = useState<DiffMode>('split')
  const [showAllContext, setShowAllContext] = useState(false)
  const [showSectionSummary, setShowSectionSummary] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions])
  const fromVersion = versions.find((v) => v.id === fromId) ?? null
  const toVersion = versions.find((v) => v.id === toId) ?? null

  const diff = useMemo(() => {
    if (!fromVersion || !toVersion || fromId === toId) return []
    return computeLineDiff(fromVersion.contentMd, toVersion.contentMd)
  }, [fromVersion, toVersion, fromId, toId])

  const stats = useMemo(() => getDiffStats(diff), [diff])
  const sectionChanges = useMemo(
    () => getSectionChanges(diff).filter((s) => s.status !== 'unchanged'),
    [diff],
  )

  const hasChanges = stats.added > 0 || stats.removed > 0
  const isSameVersion = fromId === toId

  // ── Jump to next / previous change ──────────────────────────────────────
  const getChangeBlocks = useCallback(() => {
    if (!scrollRef.current) return []
    return Array.from(scrollRef.current.querySelectorAll<HTMLElement>('[data-change-block]'))
  }, [])

  const jumpToChange = useCallback((direction: 'next' | 'prev') => {
    const blocks = getChangeBlocks()
    if (blocks.length === 0) return
    const container = scrollRef.current!
    const mid = container.scrollTop + container.clientHeight / 2

    if (direction === 'next') {
      const next = blocks.find((el) => el.offsetTop > mid + 10)
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else blocks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      const prev = [...blocks].reverse().find((el) => el.offsetTop < mid - 10)
      if (prev) prev.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else blocks[blocks.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [getChangeBlocks])

  const jumpToSection = useCallback((heading: string) => {
    if (!scrollRef.current) return
    const sectionText = heading.replace(/^#+\s*/, '')
    const blocks = Array.from(scrollRef.current.querySelectorAll<HTMLElement>('[data-change-block]'))
    // Find the block whose rendered text starts with the section heading
    const target = blocks.find((el) => el.textContent?.includes(sectionText))
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0 flex-wrap">
          <GitCompare className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold mr-1 shrink-0">Compare Versions</span>

          {/* From */}
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger className="h-7 text-xs w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {versionLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {/* To */}
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger className="h-7 text-xs w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((v) => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {versionLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stats */}
          {hasChanges && (
            <div className="flex items-center gap-1 ml-1">
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                <Plus className="h-3 w-3" />{stats.added}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                <Minus className="h-3 w-3" />{stats.removed}
              </span>
              <span className="text-xs text-muted-foreground">{stats.unchanged} unchanged</span>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {/* Mode toggle */}
            <div className="flex items-center rounded-md border bg-muted p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setMode('split')}
                title="Side-by-side"
                className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors', mode === 'split' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <Columns2 className="h-3.5 w-3.5" />
                Split
              </button>
              <button
                type="button"
                onClick={() => setMode('unified')}
                title="Unified diff"
                className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors', mode === 'unified' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <AlignJustify className="h-3.5 w-3.5" />
                Unified
              </button>
            </div>

            {/* Jump prev/next change */}
            {hasChanges && (
              <div className="flex items-center gap-0.5">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => jumpToChange('prev')} title="Previous change">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => jumpToChange('next')} title="Next change">
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAllContext((v) => !v)}>
              {showAllContext ? 'Collapse' : 'Expand all'}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Section change summary ── */}
        {sectionChanges.length > 0 && (
          <div className="border-b shrink-0">
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
              onClick={() => setShowSectionSummary((v) => !v)}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showSectionSummary && '-rotate-90')} />
              <span className="font-medium text-foreground">{sectionChanges.length} section{sectionChanges.length !== 1 ? 's' : ''} changed</span>
              <span className="ml-1">— click to {showSectionSummary ? 'hide' : 'show'}</span>
            </button>
            {showSectionSummary && (
              <div className="flex flex-wrap gap-2 px-4 pb-2.5">
                {sectionChanges.map((s, i) => (
                  <button
                    key={i}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    onClick={() => jumpToSection(s.heading)}
                    title="Jump to this section"
                  >
                    <span className="text-xs text-foreground/80 font-mono truncate max-w-[200px]">
                      {s.heading.replace(/^#+\s*/, '')}
                    </span>
                    <SectionStatusBadge status={s.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Diff body ── */}
        {isSameVersion ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2 flex-1">
            <GitCompare className="h-8 w-8 opacity-30" />
            <p className="text-sm">Select two different versions to compare.</p>
          </div>
        ) : !hasChanges ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2 flex-1">
            <p className="text-sm font-medium">These versions are identical.</p>
            <p className="text-xs">No content differences found between {fromVersion ? versionLabel(fromVersion) : ''} and {toVersion ? versionLabel(toVersion) : ''}.</p>
          </div>
        ) : mode === 'split' && fromVersion && toVersion ? (
          <SplitView
            diff={diff}
            fromVersion={fromVersion}
            toVersion={toVersion}
            showAllContext={showAllContext}
            onExpandAll={() => setShowAllContext(true)}
            scrollRef={scrollRef}
          />
        ) : fromVersion && toVersion ? (
          <UnifiedView
            diff={diff}
            fromVersion={fromVersion}
            toVersion={toVersion}
            showAllContext={showAllContext}
            onExpandAll={() => setShowAllContext(true)}
            scrollRef={scrollRef}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
