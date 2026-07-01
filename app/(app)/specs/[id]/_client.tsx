'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import {
  Eye,
  Edit3,
  MessageSquare,
  History,
  Download,
  RefreshCw,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronRight,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn, timeAgo } from '@/lib/utils'
import { CommentPanel, type PRDComment } from '@/components/spec/CommentPanel'
import { GenerationDialog } from '@/components/spec/GenerationDialog'
import { RegenerationDialog } from '@/components/spec/RegenerationDialog'
import { VersionHistory } from '@/components/spec/VersionHistory'
import { VersionDiffView } from '@/components/spec/VersionDiffView'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpecVersion = {
  id: string
  specId: string
  version: number
  versionName?: string | null
  contentMd: string
  changedByUserId?: string | null
  changeSummary?: string | null
  provider: string
  model: string
  generationMode: string
  generationScope: string
  parentVersionId?: string | null
  commentsApplied: number
  createdAt: string
  changedBy?: { name: string | null } | null
  _count?: { comments: number }
}

type Spec = {
  id: string
  title: string
  contentMd: string
  version: number
  generationMethod: string
  lifecycleState: string
  templateType: string
  approvedByUserId?: string | null
  approvedVersionId?: string | null
  approvedAt?: string | null
  handoffStatus: string
  roadmapItemId?: string | null
  roadmapItem: {
    id: string
    title: string
    category: string
    status: string
    description: string
    targetQuarter?: string | null
    jiraKey?: string | null
    notes?: string
    riceReach?: number
    riceImpact?: number
    riceConfidence?: number
    riceEffort?: number
    priorityScore?: number
  }
  versions: SpecVersion[]
  createdAt: string
  updatedAt: string
}

interface SpecWorkspaceClientProps {
  spec: Spec
  userId: string
  userName: string
  userRole: string
  // AUDIT S3-1: capability flags derived from real permissions on the server.
  canReview: boolean
  canSubmit: boolean
  llmConfigs: { id: string; label: string; provider: string; defaultModel: string }[]
}

type ActiveMode = 'read' | 'review' | 'edit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
}

interface TocEntry {
  level: number
  text: string
  slug: string
}

function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split('\n')
  const entries: TocEntry[] = []
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/)
    if (m) {
      const level = m[1].length
      const text = m[2].trim()
      entries.push({ level, text, slug: slugify(text) })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Lifecycle badge + actions
// ---------------------------------------------------------------------------

function LifecycleBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    SUBMITTED: { label: 'Submitted for Review', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    IN_REVIEW: { label: 'In Review', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    CHANGES_REQUESTED: { label: 'Changes Requested', className: 'bg-orange-100 text-orange-700 border-orange-300' },
    NEEDS_REVISION: { label: 'Needs Revision', className: 'bg-orange-100 text-orange-700 border-orange-300' },
    REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-300' },
    APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-300' },
    ARCHIVED: { label: 'Archived', className: 'bg-gray-100 text-gray-500 border-gray-300' },
  }
  const { label, className } = config[state] ?? {
    label: state,
    className: 'bg-secondary text-secondary-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Non-current version banner
// ---------------------------------------------------------------------------

function NonCurrentVersionBanner({
  viewingVersion,
  latestVersion,
  onViewCurrent,
}: {
  viewingVersion: number
  latestVersion: number
  onViewCurrent: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 mb-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Viewing <strong>v{viewingVersion}</strong> — current is <strong>v{latestVersion}</strong>. Read-only.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
        onClick={onViewCurrent}
      >
        Switch to Current
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TOC Sidebar
// ---------------------------------------------------------------------------

interface TocSidebarProps {
  entries: TocEntry[]
  activeSlug: string | null
}

function TocSidebar({ entries, activeSlug }: TocSidebarProps) {
  if (entries.length === 0) return null

  return (
    <nav className="w-52 shrink-0 border-r overflow-y-auto py-4 px-3 hidden lg:block">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Contents
      </p>
      <ul className="space-y-0.5">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <a
              href={`#section-${entry.slug}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(`section-${entry.slug}`)
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className={cn(
                'block truncate rounded px-2 py-1 text-xs transition-colors hover:bg-muted',
                entry.level === 1 && 'font-medium',
                entry.level === 2 && 'pl-4',
                entry.level === 3 && 'pl-6 text-muted-foreground',
                activeSlug === entry.slug
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/80'
              )}
              title={entry.text}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Comment form popup for review mode
// ---------------------------------------------------------------------------

interface CommentFormState {
  x: number
  y: number
  anchorText: string
  anchorStart: number
  anchorEnd: number
  sectionName: string
}

interface CommentFormPopupProps {
  state: CommentFormState
  specId: string
  versionId: string
  userName: string
  onSubmitted: (comment: PRDComment) => void
  onClose: () => void
}

const ISSUE_TYPES = [
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'unclear', label: 'Unclear' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'too_generic', label: 'Too Generic' },
  { value: 'rewrite_needed', label: 'Rewrite Needed' },
  { value: 'missing_edge_case', label: 'Missing Edge Case' },
  { value: 'missing_acceptance_criteria', label: 'Missing AC' },
  { value: 'business_issue', label: 'Business Issue' },
  { value: 'technical_clarification', label: 'Technical Clarification' },
]

const SEVERITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

function CommentFormPopup({
  state,
  specId,
  versionId,
  userName,
  onSubmitted,
  onClose,
}: CommentFormPopupProps) {
  const [issueType, setIssueType] = useState('unclear')
  const [severity, setSeverity] = useState('MEDIUM')
  const [body, setBody] = useState('')
  const [includeInRegeneration, setIncludeInRegeneration] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    if (!body.trim()) {
      toast.error('Comment body is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/specs/${specId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specVersionId: versionId,
          anchorStart: state.anchorStart,
          anchorEnd: state.anchorEnd,
          anchorText: state.anchorText,
          sectionName: state.sectionName,
          issueType,
          severity,
          body: body.trim(),
          includeInRegeneration,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to add comment')
      }
      const comment: PRDComment = await res.json()
      toast.success('Comment added')
      onSubmitted(comment)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Clamp position so popup stays within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(state.y, window.innerHeight - 420),
    left: Math.min(state.x, window.innerWidth - 320),
    zIndex: 50,
    width: 300,
  }

  return (
    <div
      ref={popupRef}
      style={style}
      className="rounded-lg border bg-background shadow-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add Comment</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {state.anchorText && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2 truncate">
          &ldquo;{state.anchorText.slice(0, 80)}&rdquo;
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Issue type</Label>
        <Select value={issueType} onValueChange={setIssueType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ISSUE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Severity</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Comment</Label>
        <Textarea
          placeholder="Describe the issue..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="text-xs resize-none"
          autoFocus
        />
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
        <Checkbox
          checked={includeInRegeneration}
          onCheckedChange={(v) => setIncludeInRegeneration(v === true)}
          className="h-3.5 w-3.5"
        />
        <span className="text-muted-foreground">Include in regeneration</span>
      </label>

      <Button
        size="sm"
        className="w-full"
        onClick={handleSubmit}
        disabled={submitting || !body.trim()}
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
        Submit
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selection tooltip (small floating button in review mode)
// ---------------------------------------------------------------------------

interface SelectionTooltipProps {
  x: number
  y: number
  onClick: () => void
}

function SelectionTooltip({ x, y, onClick }: SelectionTooltipProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y - 36,
    left: x - 56,
    zIndex: 49,
  }
  return (
    <div style={style}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onClick()
        }}
        className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg hover:bg-foreground/90 transition-colors"
      >
        <MessageSquare className="h-3 w-3" />
        Add Comment
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PRD content renderer (Read + Review modes)
// ---------------------------------------------------------------------------

interface PrdContentProps {
  content: string
  mode: 'read' | 'review'
  comments: PRDComment[]
  activeCommentId: string | null
  onCommentClick: (id: string) => void
  onTextSelected: (state: CommentFormState) => void
  contentRef: React.RefObject<HTMLDivElement>
}

function PrdContent({
  content,
  mode,
  comments,
  activeCommentId,
  onCommentClick,
  onTextSelected,
  contentRef,
}: PrdContentProps) {
  // Build a map of anchorText -> commentId for highlight rendering
  const anchorMap = useMemo(() => {
    const map: Map<string, string> = new Map()
    for (const c of comments) {
      if (c.anchorText && !map.has(c.anchorText)) {
        map.set(c.anchorText, c.id)
      }
    }
    return map
  }, [comments])

  // Custom component to wrap text with highlights
  // We do post-render DOM manipulation via effect for anchor highlighting
  const highlightAnchors = useCallback(() => {
    if (!contentRef.current) return
    // Remove previous highlights
    const existing = contentRef.current.querySelectorAll('[data-comment-id]')
    existing.forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        el.childNodes.forEach((child) => parent.insertBefore(child.cloneNode(true), el))
        parent.removeChild(el)
      }
    })
    if (anchorMap.size === 0) return

    // Walk text nodes and wrap first match
    anchorMap.forEach((commentId, anchorText) => {
      if (!anchorText || !contentRef.current) return
      const walker = document.createTreeWalker(
        contentRef.current,
        NodeFilter.SHOW_TEXT,
        null
      )
      let node: Text | null = null
      while ((node = walker.nextNode() as Text | null)) {
        const idx = node.textContent?.indexOf(anchorText) ?? -1
        if (idx !== -1) {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + anchorText.length)
          const mark = document.createElement('mark')
          mark.setAttribute('data-comment-id', commentId)
          mark.style.cssText =
            'background-color: rgba(234, 179, 8, 0.3); border-radius: 2px; cursor: pointer; padding: 1px 0;'
          if (activeCommentId === commentId) {
            mark.style.backgroundColor = 'rgba(234, 179, 8, 0.6)'
            mark.style.outline = '1px solid rgba(234, 179, 8, 0.8)'
          }
          mark.onclick = () => onCommentClick(commentId)
          try {
            range.surroundContents(mark)
          } catch {
            // surroundContents fails if range crosses element boundaries; skip
          }
          break
        }
      }
    })
  }, [anchorMap, activeCommentId, onCommentClick, contentRef])

  useEffect(() => {
    // Small delay to let ReactMarkdown finish rendering
    const id = setTimeout(highlightAnchors, 50)
    return () => clearTimeout(id)
  }, [highlightAnchors, content])

  // Current section detection for comment form
  const getSectionNameAtSelection = useCallback((): string => {
    if (!contentRef.current) return 'General'
    const headers = contentRef.current.querySelectorAll('h1, h2, h3')
    let section = 'General'
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return section
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const selY = rect.top

    headers.forEach((header) => {
      const headerRect = header.getBoundingClientRect()
      if (headerRect.top <= selY) {
        section = header.textContent ?? 'General'
      }
    })
    return section
  }, [contentRef])

  const handleMouseUp = useCallback(() => {
    if (mode !== 'review') return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return
    const selectedText = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const sectionName = getSectionNameAtSelection()

    // Compute approximate character offsets within the rendered text
    // We use contentRef text content as the source
    const fullText = contentRef.current?.innerText ?? ''
    const anchorStart = fullText.indexOf(selectedText)
    const anchorEnd = anchorStart === -1 ? 0 : anchorStart + selectedText.length

    onTextSelected({
      x: rect.left + rect.width / 2,
      y: rect.top,
      anchorText: selectedText,
      anchorStart,
      anchorEnd,
      sectionName,
    })
  }, [mode, onTextSelected, getSectionNameAtSelection, contentRef])

  return (
    <div
      ref={contentRef}
      onMouseUp={handleMouseUp}
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base',
        'prose-p:leading-relaxed prose-li:leading-relaxed',
        'prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm',
        'prose-pre:bg-muted prose-pre:rounded-lg',
        'prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/30',
        'prose-a:text-primary',
        mode === 'review' && 'cursor-text select-text'
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => {
            const text = String(children)
            const slug = slugify(text)
            return (
              <h1 id={`section-${slug}`} {...props}>
                {children}
              </h1>
            )
          },
          h2: ({ children, ...props }) => {
            const text = String(children)
            const slug = slugify(text)
            return (
              <h2 id={`section-${slug}`} {...props}>
                {children}
              </h2>
            )
          },
          h3: ({ children, ...props }) => {
            const text = String(children)
            const slug = slugify(text)
            return (
              <h3 id={`section-${slug}`} {...props}>
                {children}
              </h3>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SpecWorkspaceClient({
  spec,
  userId: _userId,
  userName,
  userRole,
  canReview,
  canSubmit,
  llmConfigs,
}: SpecWorkspaceClientProps) {
  // AUDIT S3-1: canReview/canSubmit are real permission flags from the server.
  // ---- state ----
  const [activeMode, setActiveMode] = useState<ActiveMode>('read')
  const [editContent, setEditContent] = useState(spec.contentMd)
  const [isSaving, setIsSaving] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saving'>('idle')

  const currentVersion = spec.versions[0] ?? null
  const [activeVersionId, setActiveVersionId] = useState<string>(currentVersion?.id ?? '')
  const [activeVersionContent, setActiveVersionContent] = useState<string>(spec.contentMd)

  const [versions, setVersions] = useState<SpecVersion[]>(spec.versions)
  const [comments, setComments] = useState<PRDComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const [showComments, setShowComments] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showGenerationDialog, setShowGenerationDialog] = useState(false)
  const [showRegenerationDialog, setShowRegenerationDialog] = useState(false)
  const [showDiffDialog, setShowDiffDialog] = useState(false)
  const [diffFromId, setDiffFromId] = useState<string>('')
  const [diffToId, setDiffToId] = useState<string>('')

  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [lifecycleState, setLifecycleState] = useState(spec.lifecycleState)
  // AUDIT S3-2: review feedback state + modal for reject/request-changes.
  const [reviewFeedback, setReviewFeedback] = useState<string>((spec as any).reviewFeedback ?? '')
  const [reviewModal, setReviewModal] = useState<{ action: 'REJECT' | 'REQUEST_REVISION' } | null>(null)
  const [reviewFeedbackText, setReviewFeedbackText] = useState('')

  // Review mode: selection state
  const [selectionTooltip, setSelectionTooltip] = useState<CommentFormState | null>(null)
  const [commentFormState, setCommentFormState] = useState<CommentFormState | null>(null)

  // TOC active section
  const [activeTocSlug, setActiveTocSlug] = useState<string | null>(null)

  // Refs
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const centerPanelRef = useRef<HTMLDivElement>(null)

  // Derived
  const isViewingCurrentVersion = activeVersionId === (currentVersion?.id ?? '')
  const toc = useMemo(() => extractToc(activeVersionContent), [activeVersionContent])
  const unresolvedCount = useMemo(
    () => comments.filter((c) => c.status !== 'RESOLVED').length,
    [comments]
  )
  const currentVersionObj = versions.find((v) => v.id === activeVersionId) ?? null

  // ---- fetch comments ----
  const fetchComments = useCallback(async (versionId: string) => {
    if (!versionId) return
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/specs/${spec.id}/comments?versionId=${versionId}`)
      if (!res.ok) throw new Error('Failed to load comments')
      const data: PRDComment[] = await res.json()
      setComments(data)
    } catch {
      toast.error('Failed to load comments')
    } finally {
      setCommentsLoading(false)
    }
  }, [spec.id])

  useEffect(() => {
    fetchComments(activeVersionId)
  }, [activeVersionId, fetchComments])

  // ---- fetch versions ----
  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/specs/${spec.id}/versions`)
      if (!res.ok) throw new Error('Failed to load versions')
      const data: SpecVersion[] = await res.json()
      setVersions(data)
      return data
    } catch {
      toast.error('Failed to load versions')
      return versions
    }
  }, [spec.id, versions])

  // ---- TOC intersection observer ----
  useEffect(() => {
    if (toc.length === 0 || !centerPanelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id
            if (id.startsWith('section-')) {
              setActiveTocSlug(id.replace('section-', ''))
            }
          }
        }
      },
      { root: centerPanelRef.current, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    const els = centerPanelRef.current.querySelectorAll('[id^="section-"]')
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [toc, activeVersionContent, activeMode])

  // ---- autosave ----
  const handleEditChange = useCallback((val: string) => {
    setEditContent(val)
    setAutosaveStatus('pending')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      setAutosaveStatus('saving')
      try {
        const res = await fetch(`/api/specs/${spec.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentMd: val,
            changeSummary: 'Manual edit',
            generationMode: 'MANUAL_EDIT',
          }),
        })
        if (!res.ok) throw new Error('Autosave failed')
        const updated = await res.json()
        if (updated.versions) setVersions(updated.versions)
        setAutosaveStatus('idle')
        // Update active version content if we're on current
        if (isViewingCurrentVersion) {
          setActiveVersionContent(val)
        }
      } catch {
        setAutosaveStatus('idle')
        toast.error('Autosave failed')
      }
    }, 3000)
  }, [spec.id, isViewingCurrentVersion])

  // ---- manual save ----
  const handleSave = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setIsSaving(true)
    setAutosaveStatus('saving')
    try {
      const res = await fetch(`/api/specs/${spec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentMd: editContent,
          changeSummary: 'Manual edit',
          generationMode: 'MANUAL_EDIT',
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      if (updated.versions) setVersions(updated.versions)
      setActiveVersionContent(editContent)
      setAutosaveStatus('idle')
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setIsSaving(false)
      setAutosaveStatus('idle')
    }
  }

  // ---- export ----
  const handleExport = () => {
    const blob = new Blob([activeVersionContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${spec.title.replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- lifecycle actions ----
  // AUDIT S3-2: REJECT / REQUEST_REVISION carry required reviewer feedback so the
  // author gets an explanation instead of a bare "Rejected" badge.
  const handleLifecycleAction = async (action: string, feedback?: string) => {
    try {
      const res = await fetch(`/api/specs/${spec.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(feedback ? { feedback } : {}) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Action failed')
      }
      const data = await res.json()
      const newState: string = data.lifecycleState ?? data.state ?? lifecycleState
      setLifecycleState(newState)
      if (feedback !== undefined) setReviewFeedback(feedback)
      toast.success(
        action === 'SUBMIT_REVIEW'
          ? 'Submitted for review'
          : action === 'APPROVE'
          ? 'Spec approved'
          : action === 'REJECT'
          ? 'Spec rejected'
          : 'Revision requested'
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  // AUDIT S3-2: modal that collects required feedback for reject / request-changes.
  const submitReviewDecision = async () => {
    if (!reviewModal) return
    if (!reviewFeedbackText.trim()) {
      toast.error('Please add feedback explaining your decision')
      return
    }
    await handleLifecycleAction(reviewModal.action, reviewFeedbackText.trim())
    setReviewModal(null)
    setReviewFeedbackText('')
  }

  // ---- version selection ----
  const handleSelectVersion = useCallback((version: SpecVersion) => {
    setActiveVersionId(version.id)
    setActiveVersionContent(version.contentMd)
    // Historical versions are read-only — always open in read mode
    if (version.id !== currentVersion?.id) {
      setActiveMode('read')
    }
    setSelectionTooltip(null)
    setCommentFormState(null)
  }, [currentVersion?.id])

  const handleViewCurrent = useCallback(() => {
    if (!currentVersion) return
    setActiveVersionId(currentVersion.id)
    setActiveVersionContent(spec.contentMd)
  }, [currentVersion, spec.contentMd])

  // ---- generation/regeneration callbacks ----
  const handleGenerated = useCallback(
    async (versionId: string) => {
      const freshVersions = await fetchVersions()
      const found = freshVersions.find((v) => v.id === versionId)
      if (found) {
        setActiveVersionId(found.id)
        setActiveVersionContent(found.contentMd)
        setEditContent(found.contentMd)
      }
      await fetchComments(versionId)
    },
    [fetchVersions, fetchComments]
  )

  const handleRegenerated = useCallback(
    async (versionId: string) => {
      const freshVersions = await fetchVersions()
      const found = freshVersions.find((v) => v.id === versionId)
      if (found) {
        setActiveVersionId(found.id)
        setActiveVersionContent(found.contentMd)
        setEditContent(found.contentMd)
      }
      await fetchComments(versionId)
    },
    [fetchVersions, fetchComments]
  )

  // ---- comment callbacks ----
  const handleCommentAdded = useCallback((comment: PRDComment) => {
    setComments((prev) => [comment, ...prev])
  }, [])

  const handleCommentUpdated = useCallback((comment: PRDComment) => {
    setComments((prev) => prev.map((c) => (c.id === comment.id ? comment : c)))
  }, [])

  const handleCommentDeleted = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }, [])

  // ---- review mode selection ----
  const handleTextSelected = useCallback((state: CommentFormState) => {
    setSelectionTooltip(state)
    setCommentFormState(null)
  }, [])

  const handleAddCommentClick = useCallback(() => {
    setCommentFormState(selectionTooltip)
    setSelectionTooltip(null)
  }, [selectionTooltip])

  // Dismiss selection tooltip on scroll / click elsewhere
  useEffect(() => {
    const dismiss = () => setSelectionTooltip(null)
    window.addEventListener('scroll', dismiss, true)
    return () => window.removeEventListener('scroll', dismiss, true)
  }, [])

  // ---- scroll to active comment ----
  useEffect(() => {
    if (!activeCommentId || !showComments) return
    const el = document.querySelector(`[data-comment-card="${activeCommentId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeCommentId, showComments])

  // ---- version renamed callback ----
  const handleVersionRenamed = useCallback((versionId: string, name: string) => {
    setVersions((prev) =>
      prev.map((v) => (v.id === versionId ? { ...v, versionName: name } : v))
    )
  }, [])

  // ---- version deleted callback ----
  const handleVersionDeleted = useCallback((versionId: string) => {
    setVersions((prev) => {
      const next = prev.filter((v) => v.id !== versionId)
      return next
    })
    // If we were viewing the deleted version, switch to current
    if (activeVersionId === versionId && currentVersion) {
      setActiveVersionId(currentVersion.id)
      setActiveVersionContent(spec.contentMd)
    }
  }, [activeVersionId, currentVersion, spec.contentMd])

  // ---- open compare dialog ----
  const handleOpenCompare = useCallback((fromVersionId: string) => {
    const latest = versions.find((v) => v.id === (currentVersion?.id ?? ''))
    if (!latest) return
    setDiffFromId(fromVersionId)
    setDiffToId(latest.id)
    setShowDiffDialog(true)
  }, [versions, currentVersion])

  // ---- mode switch ----
  const handleModeChange = (mode: ActiveMode) => {
    // Historical versions are always read-only
    if (mode === 'edit' && !isViewingCurrentVersion) return
    setActiveMode(mode)
    if (mode === 'edit' && isViewingCurrentVersion) {
      setEditContent(activeVersionContent)
    }
    setSelectionTooltip(null)
    setCommentFormState(null)
  }

  // ---- render ----
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0 flex-wrap">
        {/* Left: title + version picker + lifecycle badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate max-w-[160px] md:max-w-xs" title={spec.title}>
            {spec.title}
          </h1>

          {/* Version dropdown — quick switch between versions */}
          {versions.length > 0 && (
            <Select
              value={activeVersionId}
              onValueChange={(id) => {
                const v = versions.find((ver) => ver.id === id)
                if (v) handleSelectVersion(v)
              }}
            >
              <SelectTrigger className="h-6 w-auto text-xs px-2 gap-1 border-border/60 bg-muted/50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      v{v.version}
                      {v.id === currentVersion?.id ? ' — current' : ' — older'}
                      {v.versionName ? ` · ${v.versionName}` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          <LifecycleBadge state={lifecycleState} />
        </div>

        {/* Center: mode segmented control */}
        <div className="flex items-center rounded-md border bg-muted p-0.5 gap-0.5 shrink-0">
          {(
            [
              { value: 'read', icon: Eye, label: 'Read' },
              { value: 'review', icon: MessageSquare, label: 'Review' },
              { value: 'edit', icon: Edit3, label: 'Edit' },
            ] as { value: ActiveMode; icon: React.ElementType; label: string }[]
          ).map(({ value, icon: Icon, label }) => {
            const isDisabled = value === 'edit' && !isViewingCurrentVersion
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                disabled={isDisabled}
                title={isDisabled ? 'Switch to current version to edit' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  activeMode === value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  isDisabled && 'opacity-40 cursor-not-allowed hover:text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Autosave indicator */}
          {activeMode === 'edit' && autosaveStatus !== 'idle' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {autosaveStatus === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                'Unsaved'
              )}
            </span>
          )}
          {activeMode === 'edit' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 text-xs"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          )}

          {/* Comments toggle */}
          <Button
            size="sm"
            variant={showComments ? 'secondary' : 'ghost'}
            className="h-7 text-xs gap-1.5 relative"
            onClick={() => setShowComments((v) => !v)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Comments</span>
            {unresolvedCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unresolvedCount > 99 ? '99+' : unresolvedCount}
              </span>
            )}
          </Button>

          {/* Version history */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowVersionHistory(true)}
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>

          {/* Regenerate — only available on current version */}
          {isViewingCurrentVersion && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowRegenerationDialog(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
          )}

          {/* Generate new */}
          {isViewingCurrentVersion && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowGenerationDialog(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Generate</span>
            </Button>
          )}

          {/* Lifecycle actions — only on current version, role-gated */}
          {isViewingCurrentVersion && (
            <>
              {canSubmit && ['DRAFT', 'NEEDS_REVISION', 'CHANGES_REQUESTED', 'REJECTED'].includes(lifecycleState) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleLifecycleAction('SUBMIT_REVIEW')}
                >
                  Submit for Review
                </Button>
              )}
              {canReview && ['IN_REVIEW', 'SUBMITTED'].includes(lifecycleState) && (
                <>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleLifecycleAction('APPROVE')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => { setReviewFeedbackText(''); setReviewModal({ action: 'REQUEST_REVISION' }) }}
                  >
                    Request Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => { setReviewFeedbackText(''); setReviewModal({ action: 'REJECT' }) }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {lifecycleState === 'APPROVED' && (
                <span className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Check className="h-3 w-3" />
                  Approved
                </span>
              )}
            </>
          )}

          {/* Export */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: TOC */}
        <TocSidebar entries={toc} activeSlug={activeTocSlug} />

        {/* Center: content */}
        <div
          ref={centerPanelRef}
          className="flex-1 overflow-y-auto min-w-0"
          onClick={() => {
            if (selectionTooltip) setSelectionTooltip(null)
          }}
        >
          <div className="max-w-3xl mx-auto px-6 py-6">
            {/* AUDIT S3-2: surface reviewer feedback to the author on rejected /
                changes-requested specs, so a decision is never a bare badge. */}
            {reviewFeedback && ['REJECTED', 'CHANGES_REQUESTED', 'NEEDS_REVISION'].includes(lifecycleState) && (
              <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
                  {lifecycleState === 'REJECTED' ? 'Rejected — reviewer feedback' : 'Changes requested — reviewer feedback'}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-orange-900">{reviewFeedback}</p>
              </div>
            )}
            {/* Non-current version banner */}
            {!isViewingCurrentVersion && currentVersionObj && currentVersion && (
              <NonCurrentVersionBanner
                viewingVersion={currentVersionObj.version}
                latestVersion={currentVersion.version}
                onViewCurrent={handleViewCurrent}
              />
            )}

            {/* Edit mode */}
            {activeMode === 'edit' ? (
              <textarea
                value={editContent}
                onChange={(e) => handleEditChange(e.target.value)}
                className={cn(
                  'w-full min-h-[70vh] resize-none rounded-md border border-input bg-background p-4',
                  'font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                placeholder="Write your PRD in Markdown..."
                spellCheck={false}
              />
            ) : (
              <>
                {commentsLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading comments...
                  </div>
                )}
                <PrdContent
                  content={activeVersionContent}
                  mode={activeMode}
                  comments={comments}
                  activeCommentId={activeCommentId}
                  onCommentClick={(id) => {
                    setActiveCommentId(id)
                    if (!showComments) setShowComments(true)
                  }}
                  onTextSelected={handleTextSelected}
                  contentRef={contentRef}
                />
              </>
            )}
          </div>
        </div>

        {/* Right: Comment panel */}
        {showComments && (
          <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
              <span className="text-sm font-medium">Comments</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-muted-foreground"
                onClick={() => setShowComments(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CommentPanel
                specId={spec.id}
                versionId={activeVersionId}
                comments={comments}
                onCommentAdded={handleCommentAdded}
                onCommentUpdated={handleCommentUpdated}
                onCommentDeleted={handleCommentDeleted}
                activeCommentId={activeCommentId}
                onCommentClick={setActiveCommentId}
                readOnly={activeMode === 'read'}
              />
            </div>
          </div>
        )}
      </div>

      {/* Selection tooltip (review mode) */}
      {activeMode === 'review' && selectionTooltip && !commentFormState && (
        <SelectionTooltip
          x={selectionTooltip.x}
          y={selectionTooltip.y}
          onClick={handleAddCommentClick}
        />
      )}

      {/* Comment form popup (review mode) */}
      {activeMode === 'review' && commentFormState && (
        <CommentFormPopup
          state={commentFormState}
          specId={spec.id}
          versionId={activeVersionId}
          userName={userName}
          onSubmitted={handleCommentAdded}
          onClose={() => setCommentFormState(null)}
        />
      )}

      {/* Version History Sheet */}
      <Sheet open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <SheetContent side="right" className="max-w-lg w-full flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>Version History</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-4 py-4">
            <VersionHistory
              specId={spec.id}
              versions={versions}
              currentVersionId={currentVersion?.id ?? ''}
              lifecycleState={lifecycleState}
              approvedVersionId={spec.approvedVersionId ?? null}
              activeVersionId={activeVersionId}
              canDelete={canReview}
              onSelectVersion={(version) => {
                handleSelectVersion(version)
                setShowVersionHistory(false)
              }}
              onVersionRenamed={handleVersionRenamed}
              onVersionDeleted={handleVersionDeleted}
              onCompare={(versionId) => {
                handleOpenCompare(versionId)
                setShowVersionHistory(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Generation Dialog */}
      <GenerationDialog
        open={showGenerationDialog}
        onOpenChange={setShowGenerationDialog}
        specId={spec.id}
        roadmapItem={spec.roadmapItem}
        llmConfigs={llmConfigs}
        onGenerated={handleGenerated}
      />

      {/* Regeneration Dialog */}
      <RegenerationDialog
        open={showRegenerationDialog}
        onOpenChange={setShowRegenerationDialog}
        specId={spec.id}
        currentVersionId={activeVersionId}
        currentVersionNumber={currentVersionObj?.version ?? spec.version}
        comments={comments}
        llmConfigs={llmConfigs}
        onRegenerated={handleRegenerated}
      />

      {/* Version Diff Dialog */}
      {showDiffDialog && diffFromId && diffToId && (
        <VersionDiffView
          open={showDiffDialog}
          onClose={() => setShowDiffDialog(false)}
          versions={versions.map((v) => ({
            id: v.id,
            version: v.version,
            versionName: v.versionName,
            contentMd: v.contentMd,
            createdAt: v.createdAt,
            changeSummary: v.changeSummary,
            generationMode: v.generationMode,
          }))}
          initialFromId={diffFromId}
          initialToId={diffToId}
        />
      )}

      {/* AUDIT S3-2: reviewer feedback modal for reject / request-changes */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">
              {reviewModal.action === 'REJECT' ? 'Reject spec' : 'Request changes'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Explain what needs to change so the author can act on it. This is shared with the author.
            </p>
            <Textarea
              autoFocus
              value={reviewFeedbackText}
              onChange={(e) => setReviewFeedbackText(e.target.value)}
              placeholder="Your feedback…"
              className="mt-3 min-h-[120px] text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setReviewModal(null); setReviewFeedbackText('') }}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={submitReviewDecision}>
                {reviewModal.action === 'REJECT' ? 'Reject' : 'Request changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
