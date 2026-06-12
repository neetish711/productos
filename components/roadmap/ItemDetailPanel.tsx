'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Link2,
  Settings,
  Sparkles,
  Unlink,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { cn, computeRICEScore, timeAgo } from '@/lib/utils'
import { FeatureDetailsInput } from '@/components/ui/feature-details-input'
import { PrototypeTab } from '@/components/roadmap/prototype/PrototypeTab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoadmapItem {
  id: string
  title: string
  description: string | null
  category: string | null
  status: string
  targetQuarter: string | null
  jiraKey: string | null
  jiraStatus: string | null
  notes: string | null
  specStatus: SpecStatus
  duplicatedFromId: string | null
  isDraft: boolean
  sourceType: SourceType
  riceReach: number
  riceImpact: number
  riceConfidence: number
  riceEffort: number
  productId: string
  spec: {
    id: string
    version: number
    lifecycleState: string
  } | null
  createdAt: string
  updatedAt: string
  // Prototype fields (optional — may be absent on older rows)
  prototypeStatus?: string | null
  lovableProjectUrl?: string | null
  githubRepoUrl?: string | null
  githubBranch?: string | null
}

export type SpecStatus =
  | 'NO_SPEC'
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'NEEDS_REVISION'

export type SourceType =
  | 'MANUAL'
  | 'IMPORTED'
  | 'AI_SUGGESTED'
  | 'DUPLICATED'
  | 'MERGED'

export interface ItemDetailPanelProps {
  item: RoadmapItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (updated: RoadmapItem) => void
  products: { id: string; name: string }[]
}

// ---------------------------------------------------------------------------
// Status options
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = [
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

// ---------------------------------------------------------------------------
// Spec status badge
// ---------------------------------------------------------------------------
const SPEC_STATUS_CONFIG: Record<
  SpecStatus,
  { label: string; className: string }
> = {
  NO_SPEC: { label: 'No Spec', className: 'bg-muted text-muted-foreground' },
  DRAFT: { label: 'Draft', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  NEEDS_REVISION: { label: 'Needs Revision', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function SpecStatusBadge({ status }: { status: SpecStatus }) {
  const cfg = SPEC_STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Source type badge
// ---------------------------------------------------------------------------
const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  MANUAL: 'Manual',
  IMPORTED: 'Imported',
  AI_SUGGESTED: 'AI Suggested',
  DUPLICATED: 'Duplicated',
  MERGED: 'Merged',
}

function SourceTypeBadge({ type }: { type: SourceType }) {
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {SOURCE_TYPE_LABEL[type]}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------
const DEPENDENCY_TYPES = [
  { value: 'BLOCKS', label: 'Blocks' },
  { value: 'BLOCKED_BY', label: 'Blocked by' },
  { value: 'RELATES_TO', label: 'Relates to' },
  { value: 'DUPLICATES', label: 'Duplicates' },
]

interface Dependency {
  id: string
  type: string
  direction: 'outgoing' | 'incoming'
  relatedItem: {
    id: string
    title: string
    status: string
  }
}

// ---------------------------------------------------------------------------
// Activity event types
// ---------------------------------------------------------------------------
interface ActivityEvent {
  id: string
  eventType: string
  description: string
  actor: { name: string } | null
  createdAt: string
}

function eventIcon(eventType: string) {
  if (eventType.includes('CREATE')) return <Plus className="h-3.5 w-3.5" />
  if (eventType.includes('UPDATE')) return <Edit3 className="h-3.5 w-3.5" />
  if (eventType.includes('LINK')) return <Link2 className="h-3.5 w-3.5" />
  if (eventType.includes('UNLINK')) return <Unlink className="h-3.5 w-3.5" />
  if (eventType.includes('SPEC')) return <FileText className="h-3.5 w-3.5" />
  if (eventType.includes('STATUS')) return <Tag className="h-3.5 w-3.5" />
  return <Clock className="h-3.5 w-3.5" />
}

// ---------------------------------------------------------------------------
// Types for API-driven prompts
// ---------------------------------------------------------------------------
interface LLMConfigOption {
  id: string
  provider: string
  label: string
  defaultModel: string
  isActive: boolean
}

interface SpecPrompt {
  id: string
  name: string
  description: string
  templateText: string
  version: number
}

// ---------------------------------------------------------------------------
// CreateSpecDialog — templates loaded from Prompt Management
// ---------------------------------------------------------------------------
interface CreateSpecDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: RoadmapItem
  onSuccess: (specId: string) => void
}

function CreateSpecDialog({ open, onOpenChange, item, onSuccess }: CreateSpecDialogProps) {
  const [llmConfigs, setLLMConfigs] = useState<LLMConfigOption[]>([])
  const [specPrompts, setSpecPrompts] = useState<SpecPrompt[]>([])
  // 'idle' | 'loading' | 'ready' | 'error'
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [selectedLLMId, setSelectedLLMId] = useState<string>('')
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [featureDetails, setFeatureDetails] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  // Fetch LLM configs + spec-generation prompts in parallel when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadState('loading')
    Promise.all([
      fetch('/api/llm-configs').then((r) => r.json()),
      fetch('/api/prompts?category=spec-generation').then((r) => r.json()),
    ])
      .then(([configs, prompts]) => {
        const cfgs: LLMConfigOption[] = Array.isArray(configs) ? configs : []
        const pts: SpecPrompt[] = Array.isArray(prompts) ? prompts : []
        setLLMConfigs(cfgs)
        setSpecPrompts(pts)
        const active = cfgs.find((c) => c.isActive)
        setSelectedLLMId(active?.id ?? cfgs[0]?.id ?? '')
        setSelectedPromptId(pts[0]?.id ?? '')
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [open])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFeatureDetails('')
    }
  }, [open])

  const selectedPrompt = specPrompts.find((p) => p.id === selectedPromptId) ?? null

  // Build prompt preview with title + context placeholder filled in
  const previewPrompt = selectedPrompt
    ? selectedPrompt.templateText
        .replace(/\{\{title\}\}/gi, item.title)
        .replace(/\{TITLE\}/g, item.title)
        .replace(/\{\{context\}\}/gi, '[item context injected at generation time]')
    : ''

  const hasNoLLM = loadState === 'ready' && llmConfigs.length === 0
  const hasNoTemplates = loadState === 'ready' && specPrompts.length === 0
  const canGenerate = !isWorking && !!selectedLLMId && !!selectedPromptId && !!featureDetails.trim()

  const handleGenerate = async () => {
    setIsWorking(true)
    try {
      // Step 1: create the spec record
      const createRes = await fetch('/api/specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapItemId: item.id,
          title: item.title,
          generationMethod: 'AI_GENERATED',
          templateType: selectedPrompt?.name ?? 'FULL_PRD',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        throw new Error(err.error ?? err.message ?? 'Failed to create spec')
      }
      const spec = await createRes.json()

      // Step 2: generate with the selected LLM + DB prompt
      const genRes = await fetch(`/api/specs/${spec.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmConfigId: selectedLLMId || undefined,
          promptId: selectedPromptId || undefined,
          featureDetails: featureDetails.trim() || undefined,
        }),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err.error ?? err.message ?? 'Generation failed')
      }

      toast.success('Spec generated successfully')
      onOpenChange(false)
      onSuccess(spec.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create spec')
    } finally {
      setIsWorking(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={isWorking ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Create Spec
          </DialogTitle>
        </DialogHeader>

        {/* ── Loading ── */}
        {loadState === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Error loading ── */}
        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">Failed to load configuration</p>
            <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}

        {/* ── No LLM configured ── */}
        {hasNoLLM && (
          <div className="flex flex-col items-center gap-4 py-8 text-center px-4">
            <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
              <Settings className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">No LLM configured</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
                Spec generation requires at least one AI provider. Add your OpenAI, Anthropic, or
                Gemini API key in LLM Config settings.
              </p>
            </div>
            <Button asChild>
              <a href="/llm-config">
                <Settings className="mr-2 h-4 w-4" />
                Open LLM Config
              </a>
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {/* ── Main form ── */}
        {loadState === 'ready' && !hasNoLLM && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1">

              {/* Item context */}
              <div className="rounded-md bg-muted/50 border px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">Generating spec for</p>
                <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
              </div>

              {/* AI Provider */}
              <div className="space-y-1.5">
                <Label>AI Provider</Label>
                <Select value={selectedLLMId} onValueChange={setSelectedLLMId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a provider…" />
                  </SelectTrigger>
                  <SelectContent>
                    {llmConfigs.map((cfg) => (
                      <SelectItem key={cfg.id} value={cfg.id}>
                        {cfg.label} — {cfg.defaultModel}
                        {cfg.isActive ? ' (active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template selector */}
              <div className="space-y-1.5">
                <Label>Template</Label>

                {hasNoTemplates ? (
                  <div className="rounded-md border border-dashed px-4 py-5 text-center space-y-3">
                    <FileText className="h-7 w-7 text-muted-foreground mx-auto opacity-50" />
                    <div>
                      <p className="text-sm font-medium">No spec templates found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add templates in Prompt Management under the{' '}
                        <span className="font-mono">spec-generation</span> category.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/prompts">Go to Prompt Management</a>
                    </Button>
                  </div>
                ) : (
                  <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {specPrompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedPrompt?.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedPrompt.description}
                  </p>
                )}
              </div>

              {/* Prompt preview — shown automatically when a template is selected */}
              {selectedPrompt && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Prompt preview</p>
                    <a
                      href="/prompts"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-2"
                    >
                      Edit in Prompt Management →
                    </a>
                  </div>
                  <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-44 overflow-y-auto border">
                    {previewPrompt}
                  </pre>
                </div>
              )}

              {/* Feature Details — primary input for generation */}
              <div className="space-y-1.5">
                <div>
                  <Label htmlFor="feature-details">
                    Feature Details <span className="text-destructive text-xs">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Describe what needs to be built. The template above defines the structure; this is the actual feature content.
                  </p>
                </div>
                <FeatureDetailsInput
                  id="feature-details"
                  value={featureDetails}
                  onChange={setFeatureDetails}
                  disabled={isWorking}
                  rows={6}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 pt-2 gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={!featureDetails.trim() ? 'Add Feature Details to enable generation' : undefined}
              >
                {isWorking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Spec
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Tab: Details
// ---------------------------------------------------------------------------
function DetailsTab({
  item,
  onUpdate,
}: {
  item: RoadmapItem
  onUpdate: (updated: RoadmapItem) => void
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [category, setCategory] = useState(item.category ?? '')
  const [status, setStatus] = useState(item.status)
  const [targetQuarter, setTargetQuarter] = useState(item.targetQuarter ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [jiraKey, setJiraKey] = useState(item.jiraKey ?? '')
  const [riceReach, setRiceReach] = useState(item.riceReach ?? 0)
  const [riceImpact, setRiceImpact] = useState(item.riceImpact ?? 0)
  const [riceConfidence, setRiceConfidence] = useState(item.riceConfidence ?? 0)
  const [riceEffort, setRiceEffort] = useState(item.riceEffort ?? 1)
  const [isSaving, setIsSaving] = useState(false)
  const [isLinkingJira, setIsLinkingJira] = useState(false)

  // Keep local state in sync when item changes
  useEffect(() => {
    setTitle(item.title)
    setDescription(item.description ?? '')
    setCategory(item.category ?? '')
    setStatus(item.status)
    setTargetQuarter(item.targetQuarter ?? '')
    setNotes(item.notes ?? '')
    setJiraKey(item.jiraKey ?? '')
    setRiceReach(item.riceReach ?? 0)
    setRiceImpact(item.riceImpact ?? 0)
    setRiceConfidence(item.riceConfidence ?? 0)
    setRiceEffort(item.riceEffort ?? 1)
  }, [item.id])

  const riceScore = computeRICEScore(riceReach, riceImpact, riceConfidence, riceEffort)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/roadmap/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          status,
          targetQuarter,
          notes,
          jiraKey,
          riceReach,
          riceImpact,
          riceConfidence,
          riceEffort,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to save')
      }
      const updated: RoadmapItem = await res.json()
      onUpdate(updated)
      toast.success('Changes saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLinkJira = async () => {
    if (!jiraKey.trim()) {
      toast.error('Enter a Jira key first')
      return
    }
    setIsLinkingJira(true)
    try {
      const res = await fetch(`/api/roadmap/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jiraKey: jiraKey.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to link Jira')
      }
      const updated: RoadmapItem = await res.json()
      onUpdate(updated)
      toast.success('Jira issue linked')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to link Jira')
    } finally {
      setIsLinkingJira(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Core fields */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="detail-title">Title</Label>
          <Input
            id="detail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Roadmap item title"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-description">Description</Label>
          <Textarea
            id="detail-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this item…"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="detail-category">Category</Label>
            <Input
              id="detail-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Growth"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="detail-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-quarter">Target Quarter</Label>
          <Input
            id="detail-quarter"
            value={targetQuarter}
            onChange={(e) => setTargetQuarter(e.target.value)}
            placeholder="e.g. Q3 2025"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="detail-notes">Notes</Label>
          <Textarea
            id="detail-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes…"
            rows={3}
          />
        </div>
      </div>

      <Separator />

      {/* Jira */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Jira</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={jiraKey}
              onChange={(e) => setJiraKey(e.target.value)}
              placeholder="e.g. PROJ-123"
              className={cn(
                item.jiraKey && jiraKey === item.jiraKey
                  ? 'border-green-500 pr-8'
                  : ''
              )}
            />
            {item.jiraKey && jiraKey === item.jiraKey && (
              <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleLinkJira}
            disabled={isLinkingJira || !jiraKey.trim()}
          >
            {isLinkingJira ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Link Jira'
            )}
          </Button>
        </div>
        {item.jiraStatus && (
          <p className="text-xs text-muted-foreground">
            Jira status: <span className="font-medium">{item.jiraStatus}</span>
          </p>
        )}
      </div>

      <Separator />

      {/* RICE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">RICE Score</Label>
          <span className="text-2xl font-bold tabular-nums">{riceScore}</span>
        </div>

        {(
          [
            { field: 'riceReach', label: 'Reach', value: riceReach, setter: setRiceReach, max: 1000 },
            { field: 'riceImpact', label: 'Impact', value: riceImpact, setter: setRiceImpact, max: 10 },
            { field: 'riceConfidence', label: 'Confidence (%)', value: riceConfidence, setter: setRiceConfidence, max: 100 },
            { field: 'riceEffort', label: 'Effort', value: riceEffort, setter: setRiceEffort, max: 10 },
          ] as const
        ).map(({ field, label, value, setter, max }) => (
          <div key={field} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
            <Slider
              min={field === 'riceEffort' ? 1 : 0}
              max={max}
              step={field === 'riceConfidence' ? 5 : 1}
              value={[value]}
              onValueChange={([v]) => setter(v)}
            />
          </div>
        ))}
      </div>

      {/* Prototype summary — compact, shown if any prototype data exists */}
      {item.prototypeStatus && item.prototypeStatus !== 'NONE' && (
        <PrototypeSummarySection item={item} />
      )}

      <div className="pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prototype Summary Section (used inside DetailsTab)
// ---------------------------------------------------------------------------
function PrototypeSummarySection({ item }: { item: RoadmapItem }) {
  const PROTO_LABEL: Record<string, { label: string; badge: string }> = {
    PROMPT_GENERATED:         { label: 'Prompt Ready',      badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    PROTOTYPE_GENERATED:      { label: 'Prototype Live',    badge: 'bg-teal-100 text-teal-800 border-teal-200' },
    GITHUB_LINKED:            { label: 'GitHub Linked',     badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    READY_FOR_ENGINEERING:    { label: 'Ready for Eng',     badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    ENGINEERING_IN_PROGRESS:  { label: 'In Progress',       badge: 'bg-violet-100 text-violet-800 border-violet-200' },
    ENGINEERING_COMPLETE:     { label: 'Eng Complete',      badge: 'bg-green-100 text-green-800 border-green-200' },
  }
  const cfg = PROTO_LABEL[item.prototypeStatus ?? ''] ?? { label: item.prototypeStatus ?? '', badge: 'bg-muted text-muted-foreground' }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Prototype</span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
      <div className="space-y-1">
        {item.lovableProjectUrl && (
          <a href={item.lovableProjectUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2">
            <span className="text-violet-500">↗</span>
            Lovable project
          </a>
        )}
        {item.githubRepoUrl && (
          <a href={item.githubRepoUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2">
            <span>↗</span>
            {item.githubRepoUrl.replace('https://github.com/', '')}
            {item.githubBranch && <span className="text-muted-foreground">· {item.githubBranch}</span>}
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Spec
// ---------------------------------------------------------------------------
function SpecTab({
  item,
  onUpdate,
}: {
  item: RoadmapItem
  onUpdate: (updated: RoadmapItem) => void
}) {
  const router = useRouter()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleCreateSuccess = (specId: string) => {
    router.push(`/specs/${specId}`)
  }

  const handleGenerateNewVersion = async () => {
    if (!item.spec) return
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/specs/${item.spec.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? err.message ?? 'Failed to generate new version')
      }
      toast.success('New spec version generated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate new version')
    } finally {
      setIsGenerating(false)
    }
  }

  const lifecycleLabel = (state: string) =>
    state.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Spec status</span>
        <SpecStatusBadge status={item.specStatus} />
      </div>

      {!item.spec ? (
        <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-3 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">No spec yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a spec to document requirements for this item
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Spec
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  v{item.spec.version}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {lifecycleLabel(item.spec.lifecycleState)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Spec ID: {item.spec.id}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/specs/${item.spec!.id}`)}
              className="flex-1"
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              View Spec
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateNewVersion}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              New Version
            </Button>
          </div>
        </div>
      )}

      <CreateSpecDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        item={item}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Dependencies
// ---------------------------------------------------------------------------
function DependenciesTab({ item }: { item: RoadmapItem }) {
  const [deps, setDeps] = useState<Dependency[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [relType, setRelType] = useState('RELATES_TO')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/roadmap/${item.id}/dependencies`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDeps(data ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load dependencies')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [item.id])

  const handleAddDependency = async () => {
    if (!searchQuery.trim()) {
      toast.error('Enter a related item title or ID')
      return
    }
    setIsAdding(true)
    try {
      const res = await fetch(`/api/roadmap/${item.id}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), type: relType }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to add dependency')
      }
      const newDep: Dependency = await res.json()
      setDeps((prev) => [...prev, newDep])
      setSearchQuery('')
      setRelType('RELATES_TO')
      setShowAddForm(false)
      toast.success('Dependency added')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add dependency')
    } finally {
      setIsAdding(false)
    }
  }

  const outgoing = deps.filter((d) => d.direction === 'outgoing')
  const incoming = deps.filter((d) => d.direction === 'incoming')

  const typeLabel = (t: string) =>
    DEPENDENCY_TYPES.find((dt) => dt.value === t)?.label ?? t

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Outgoing
          </p>
          {outgoing.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{dep.relatedItem.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {typeLabel(dep.type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dep.relatedItem.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Incoming
          </p>
          {incoming.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0 rotate-180" />
                <span>{dep.relatedItem.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {typeLabel(dep.type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dep.relatedItem.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length === 0 && incoming.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground gap-2">
          <AlertCircle className="h-8 w-8" />
          <p>No dependencies yet</p>
        </div>
      )}

      {showAddForm ? (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">Add Dependency</p>
          <Input
            placeholder="Search by title or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddDependency()
            }}
          />
          <Select value={relType} onValueChange={setRelType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPENDENCY_TYPES.map((dt) => (
                <SelectItem key={dt.value} value={dt.value}>
                  {dt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setSearchQuery('')
                setRelType('RELATES_TO')
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddDependency}
              disabled={isAdding || !searchQuery.trim()}
              className="flex-1"
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Dependency
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: History
// ---------------------------------------------------------------------------
function HistoryTab({ item }: { item: RoadmapItem }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/roadmap/${item.id}/activity`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEvents(data ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load activity')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [item.id])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground gap-2">
        <Clock className="h-8 w-8" />
        <p>No activity yet</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-3.5 bottom-3.5 w-px bg-border" />

      {[...events].reverse().map((event) => (
        <div key={event.id} className="relative flex gap-3 pb-4">
          {/* Icon bubble */}
          <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
            {eventIcon(event.eventType)}
          </div>
          <div className="flex flex-col gap-0.5 pt-0.5 min-w-0">
            <p className="text-sm leading-snug">{event.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {event.actor && <span className="font-medium">{event.actor.name}</span>}
              {event.actor && <span>·</span>}
              <span>{timeAgo(event.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ItemDetailPanel({
  item,
  open,
  onOpenChange,
  onUpdate,
  products,
}: ItemDetailPanelProps) {
  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col overflow-hidden p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-2 pr-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <SourceTypeBadge type={item.sourceType} />
                {item.isDraft && (
                  <Badge variant="secondary" className="text-xs">
                    Draft
                  </Badge>
                )}
                <SpecStatusBadge status={item.specStatus} />
              </div>
              <SheetTitle className="text-base leading-tight line-clamp-2">
                {item.title}
              </SheetTitle>
              {item.jiraKey && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.jiraKey}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 shrink-0 w-auto self-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="spec">Spec</TabsTrigger>
            <TabsTrigger value="prototype" className="gap-1.5">
              Prototype
              {item.specStatus === 'APPROVED' && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <TabsContent value="details" className="mt-0">
              <DetailsTab item={item} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="spec" className="mt-0">
              <SpecTab item={item} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="prototype" className="mt-0">
              <PrototypeTab
                itemId={item.id}
                itemTitle={item.title}
                specStatus={item.specStatus}
                specVersion={item.spec?.version ?? null}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <HistoryTab item={item} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
