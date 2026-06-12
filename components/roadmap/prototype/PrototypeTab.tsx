'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sparkles, ExternalLink, Github, GitBranch, CheckCircle2,
  Clock, AlertTriangle, Loader2, RefreshCw, ChevronDown,
  ChevronRight, Eye, Copy, Check, Cpu, FileCode2, Circle, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { PublishToLovableDialog } from './PublishToLovableDialog'
import { LinkLovableProjectDialog } from './LinkLovableProjectDialog'
import { LinkGithubDialog } from './LinkGithubDialog'

interface IntegrationStatus {
  status: string
  connected: boolean
  connectedAt?: string | null
  configJson?: Record<string, any>
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  publishVersion: number
  sourcePrdVersionNum: number
  lovableProjectUrl: string | null
  githubRepoUrl: string | null
  githubBranch: string | null
  status: string
  prototypeOutdated: number
  publishedByName: string
  lovablePromptSnapshot: string
  lovablePromptVersion: number
  extractionModel: string | null
  createdAt: string
  handedOffAt: string | null
}

interface PrototypeData {
  specStatus: string
  prototypeStatus: string
  lovableProjectUrl: string | null
  githubRepoUrl: string | null
  githubBranch: string | null
  engineeringHandoffStatus: string
  prototypeIterationCount: number
  lastPublishedAt: string | null
  history: HistoryEntry[]
}

interface Props {
  itemId: string
  itemTitle: string
  specStatus: string
  specVersion: number | null
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  NONE:                    { label: 'No Prototype',           badge: 'bg-gray-100 text-gray-600 border-gray-200',        dot: 'bg-gray-300' },
  DRAFT_READY:             { label: 'Ready to Publish',       badge: 'bg-violet-100 text-violet-700 border-violet-200',  dot: 'bg-violet-400' },
  PUBLISHING:              { label: 'Awaiting Lovable Link',  badge: 'bg-amber-100 text-amber-700 border-amber-200',     dot: 'bg-amber-400 animate-pulse' },
  PROTOTYPE_GENERATED:     { label: 'Prototype Generated',    badge: 'bg-teal-100 text-teal-700 border-teal-200',        dot: 'bg-teal-400' },
  GITHUB_LINKED:           { label: 'GitHub Linked',          badge: 'bg-teal-100 text-teal-700 border-teal-200',        dot: 'bg-teal-500' },
  READY_FOR_ENGINEERING:   { label: 'Ready for Engineering',  badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  ENGINEERING_IN_PROGRESS: { label: 'Engineering In Progress',badge: 'bg-blue-100 text-blue-700 border-blue-200',        dot: 'bg-blue-400' },
}

const PUBLISH_STATUS_CONFIG: Record<string, string> = {
  PROMPT_GENERATED: 'bg-amber-100 text-amber-700 border-amber-200',
  PUBLISHED:        'bg-teal-100 text-teal-700 border-teal-200',
  PROTOTYPE_LINKED: 'bg-teal-100 text-teal-700 border-teal-200',
  GITHUB_LINKED:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  HANDED_OFF:       'bg-blue-100 text-blue-700 border-blue-200',
  SUPERSEDED:       'bg-gray-100 text-gray-500 border-gray-200',
}

// ─── PrototypeTab ─────────────────────────────────────────────────────────────

export function PrototypeTab({ itemId, itemTitle, specStatus, specVersion }: Props) {
  const [data, setData]               = useState<PrototypeData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [linkOpen,    setLinkOpen]    = useState(false)
  const [githubOpen,  setGithubOpen]  = useState(false)
  const [handoffing,  setHandoffing]  = useState(false)
  const [integrations, setIntegrations] = useState<{ lovable: IntegrationStatus; github: IntegrationStatus } | null>(null)

  const latestHistory = data?.history?.[0] ?? null
  const latestPublishId = latestHistory?.id ?? ''
  const protoStatus = data?.prototypeStatus ?? 'NONE'
  const statusCfg   = STATUS_CONFIG[protoStatus] ?? STATUS_CONFIG.NONE

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [historyRes, intRes] = await Promise.all([
        fetch(`/api/roadmap/${itemId}/lovable/history`),
        fetch('/api/integrations/status'),
      ])
      if (historyRes.ok) setData(await historyRes.json())
      if (intRes.ok) setIntegrations(await intRes.json())
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => { load() }, [load])

  const handleHandoff = async (action: 'READY' | 'IN_PROGRESS') => {
    if (!latestPublishId) return
    setHandoffing(true)
    try {
      const res = await fetch(`/api/roadmap/${itemId}/lovable/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishId: latestPublishId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      toast.success(action === 'READY' ? 'Marked ready for engineering' : 'Engineering in progress')
      await load()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update handoff status')
    } finally {
      setHandoffing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const lovableConnected = integrations?.lovable?.connected ?? false
  const githubConnected  = integrations?.github?.connected ?? false
  const specApproved     = specStatus === 'APPROVED'

  // ── State A: spec not approved ─────────────────────────────────────────────
  if (!specApproved) {
    return (
      <div className="space-y-4">
        <PrerequisitesChecklist
          specApproved={false}
          lovableConnected={lovableConnected}
          githubConnected={githubConnected}
        />
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <div className="rounded-full bg-muted/50 p-4 mb-4">
            <Cpu className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold mb-1">Spec approval required</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Prototypes require an approved PRD. Go to the{' '}
            <span className="font-medium text-foreground">Spec tab</span> to generate and approve a spec first.
          </p>
          <div className="mt-4 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            Current spec status:{' '}
            <span className="font-medium text-foreground">{specStatus.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>
    )
  }

  const isOutdated = latestHistory?.prototypeOutdated === 1

  return (
    <div className="space-y-4">

      {/* ── Prerequisites checklist (compact, only show if anything is not ready) ── */}
      {(!lovableConnected || !githubConnected) && (
        <PrerequisitesChecklist
          specApproved={true}
          lovableConnected={lovableConnected}
          githubConnected={githubConnected}
          compact
        />
      )}

      {/* ── Status header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', statusCfg.dot)} />
          <Badge className={cn('border text-xs gap-1.5', statusCfg.badge)}>
            {statusCfg.label}
          </Badge>
          {data?.prototypeIterationCount && data.prototypeIterationCount > 0
            ? <span className="text-xs text-muted-foreground">v{data.prototypeIterationCount + 1}</span>
            : null
          }
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="h-7 gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />Refresh
        </Button>
      </div>

      {/* ── Outdated warning ── */}
      {isOutdated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800">Prototype may be outdated</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The approved spec was updated after this prototype was published.
              Consider regenerating the prototype against the new spec.
            </p>
          </div>
        </div>
      )}

      {/* ── State B: ready to publish ── */}
      {protoStatus === 'NONE' || protoStatus === 'DRAFT_READY' ? (
        <ReadyToPublishPanel
          itemTitle={itemTitle}
          specVersion={specVersion}
          onPublish={() => setPublishOpen(true)}
        />
      ) : null}

      {/* ── State C/D: active prototype ── */}
      {!['NONE', 'DRAFT_READY'].includes(protoStatus) && (
        <>
          {/* Lovable project */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <p className="text-sm font-semibold">Lovable Project</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPublishOpen(true)}
                className="h-7 gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />Regenerate
              </Button>
            </div>
            {data?.lovableProjectUrl ? (
              <div className="space-y-2">
                <a href={data.lovableProjectUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 font-medium">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {data.lovableProjectUrl.replace('https://', '')}
                </a>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" asChild>
                  <a href={data.lovableProjectUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />Open in Lovable
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Created your Lovable project? Paste its URL here to link it back.
                </p>
                <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)} className="gap-2 h-8 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />Link Lovable Project URL
                </Button>
              </div>
            )}
          </div>

          {/* GitHub */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              <p className="text-sm font-semibold">GitHub Repository</p>
            </div>
            {data?.githubRepoUrl ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <a href={data.githubRepoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2 font-medium">
                    <Github className="h-3.5 w-3.5 shrink-0" />
                    {data.githubRepoUrl.replace('https://github.com/', '')}
                  </a>
                  {data.githubBranch && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      {data.githubBranch}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" asChild>
                    <a href={data.githubRepoUrl} target="_blank" rel="noopener noreferrer">
                      <Github className="h-3.5 w-3.5" />Open GitHub
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setGithubOpen(true)}
                    className="gap-2 h-8 text-xs text-muted-foreground">
                    Edit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect GitHub to your Lovable project, then link the repo and branch here.
                  Engineers need this to access and build from the prototype code.
                </p>
                <Button size="sm" variant="outline" onClick={() => setGithubOpen(true)} className="gap-2 h-8 text-xs">
                  <Github className="h-3.5 w-3.5" />Link GitHub Repository
                </Button>
              </div>
            )}
          </div>

          {/* Engineering handoff */}
          <EngineeringHandoffPanel
            protoStatus={protoStatus}
            handoffStatus={data?.engineeringHandoffStatus ?? 'NOT_STARTED'}
            publishId={latestPublishId}
            hasGithub={!!data?.githubRepoUrl}
            handoffing={handoffing}
            onHandoff={handleHandoff}
          />
        </>
      )}

      {/* ── Publish history ── */}
      {data?.history && data.history.length > 0 && (
        <PublishHistoryPanel history={data.history} specVersion={specVersion} />
      )}

      {/* ── "Also generate" prompt when no history and status is PUBLISHING ── */}
      {protoStatus === 'PUBLISHING' && !data?.history?.length && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Prompt was generated and copied. Paste it in Lovable to create your project, then link it above.
          </p>
        </div>
      )}

      {/* ── Dialogs ── */}
      <PublishToLovableDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        itemId={itemId}
        itemTitle={itemTitle}
        specVersion={specVersion}
        onPublished={async () => {
          await load()
        }}
      />
      <LinkLovableProjectDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        itemId={itemId}
        publishId={latestPublishId}
        onLinked={async () => { await load() }}
      />
      <LinkGithubDialog
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        itemId={itemId}
        publishId={latestPublishId}
        existingRepo={data?.githubRepoUrl}
        existingBranch={data?.githubBranch}
        onLinked={async () => { await load() }}
      />
    </div>
  )
}

// ─── PrerequisitesChecklist ───────────────────────────────────────────────────

function PrerequisitesChecklist({ specApproved, lovableConnected, githubConnected, compact }: {
  specApproved: boolean
  lovableConnected: boolean
  githubConnected: boolean
  compact?: boolean
}) {
  const items = [
    {
      label: 'Spec approved',
      done: specApproved,
      note: 'Generate and approve a PRD in the Spec tab',
      required: true,
    },
    {
      label: 'Lovable integration connected',
      done: lovableConnected,
      note: 'Connect your Lovable account in Settings → Integrations',
      link: '/integrations',
      required: false,
    },
    {
      label: 'GitHub integration connected',
      done: githubConnected,
      note: 'Connect GitHub in Settings → Integrations (needed before engineering handoff)',
      link: '/integrations',
      required: false,
    },
  ]

  const incompleteRequired = items.filter(i => i.required && !i.done)
  const incompleteOptional = items.filter(i => !i.required && !i.done)

  if (compact && incompleteRequired.length === 0 && incompleteOptional.length === 0) return null

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      incompleteRequired.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50/50',
    )}>
      <p className={cn('text-xs font-semibold', incompleteRequired.length > 0 ? 'text-amber-800' : 'text-blue-800')}>
        {incompleteRequired.length > 0 ? 'Setup required' : 'Recommended setup'}
      </p>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-start gap-2">
            {item.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={cn('text-xs', item.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {item.label}
              </span>
              {!item.done && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{item.note}</span>
                  {item.link && (
                    <a href={item.link} className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                      <Settings className="h-2.5 w-2.5" />Configure
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ReadyToPublishPanel ──────────────────────────────────────────────────────

function ReadyToPublishPanel({ itemTitle, specVersion, onPublish }: {
  itemTitle: string; specVersion: number | null; onPublish: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">PRD Ready to Prototype</p>
        <p className="text-xs text-muted-foreground">
          {specVersion ? `Spec v${specVersion} is approved.` : 'Spec is approved.'} Generate a Lovable-ready prompt to build a frontend prototype for this feature.
        </p>
      </div>
      <Button onClick={onPublish} className="gap-2 w-full sm:w-auto">
        <Sparkles className="h-4 w-4" />
        Publish to Lovable
      </Button>
      <div className="text-xs text-muted-foreground border-t pt-3 space-y-1.5">
        <p>This will transform the approved PRD into a structured Lovable prompt.</p>
        <p>The raw PRD is not sent — only extracted UI-relevant information.</p>
        <p className="flex items-center gap-1">
          <span>Prompt instructions:</span>
          <a href="/prompts" className="text-primary hover:underline inline-flex items-center gap-0.5">
            <Settings className="h-2.5 w-2.5" />Edit in Prompt Management
          </a>
        </p>
      </div>
    </div>
  )
}

// ─── EngineeringHandoffPanel ──────────────────────────────────────────────────

function EngineeringHandoffPanel({ protoStatus, handoffStatus, publishId, hasGithub, handoffing, onHandoff }: {
  protoStatus: string
  handoffStatus: string
  publishId: string
  hasGithub: boolean
  handoffing: boolean
  onHandoff: (action: 'READY' | 'IN_PROGRESS') => void
}) {
  const isReady       = protoStatus === 'READY_FOR_ENGINEERING'
  const isInProgress  = protoStatus === 'ENGINEERING_IN_PROGRESS'

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileCode2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Engineering Handoff</p>
        {isReady && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />Ready
          </Badge>
        )}
        {isInProgress && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs gap-1">
            <Clock className="h-3 w-3" />In Progress
          </Badge>
        )}
      </div>

      {!isReady && !isInProgress && (
        <div className="space-y-2">
          {!hasGithub && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Link a GitHub repo and branch before marking ready for engineering.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!hasGithub || handoffing || !publishId}
            onClick={() => onHandoff('READY')}
            className="gap-2 h-8 text-xs"
          >
            {handoffing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark Ready for Engineering
          </Button>
        </div>
      )}

      {isReady && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            This feature is ready for engineering. Engineers can access the Lovable prototype and GitHub repo above.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={handoffing}
            onClick={() => onHandoff('IN_PROGRESS')}
            className="gap-2 h-8 text-xs"
          >
            {handoffing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
            Mark Engineering In Progress
          </Button>
        </div>
      )}

      {isInProgress && (
        <p className="text-xs text-muted-foreground">
          Engineering is actively building this feature. The prototype and PRD serve as frontend reference.
        </p>
      )}
    </div>
  )
}

// ─── PublishHistoryPanel ──────────────────────────────────────────────────────

function PublishHistoryPanel({ history, specVersion }: { history: HistoryEntry[]; specVersion: number | null }) {
  const [open, setOpen]             = useState(false)
  const [viewPrompt, setViewPrompt] = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)

  const handleCopyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Prompt copied to clipboard')
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">
            Publish History ({history.length})
          </span>
        </div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {history.map((entry) => (
            <div key={entry.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">#{entry.publishVersion}</span>
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', PUBLISH_STATUS_CONFIG[entry.status] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                    {entry.status.replace(/_/g, ' ')}
                  </span>
                  {entry.prototypeOutdated === 1 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                      <AlertTriangle className="h-2.5 w-2.5" />outdated
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span>Spec v{entry.sourcePrdVersionNum}</span>
                <span>Prompt template v{entry.lovablePromptVersion}</span>
                {entry.extractionModel && <span>{entry.extractionModel}</span>}
                {entry.publishedByName && <span>by {entry.publishedByName}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm"
                  onClick={() => setViewPrompt(viewPrompt === entry.id ? null : entry.id)}
                  className="h-6 gap-1 text-[10px] text-muted-foreground">
                  <Eye className="h-2.5 w-2.5" />
                  {viewPrompt === entry.id ? 'Hide prompt' : 'View prompt snapshot'}
                </Button>
                {viewPrompt === entry.id && (
                  <Button variant="ghost" size="sm"
                    onClick={() => handleCopyPrompt(entry.lovablePromptSnapshot)}
                    className="h-6 gap-1 text-[10px] text-muted-foreground">
                    {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                    Copy
                  </Button>
                )}
              </div>
              {viewPrompt === entry.id && (
                <ScrollArea className="h-40 rounded border bg-muted/20">
                  <pre className="p-3 text-[10px] leading-relaxed whitespace-pre-wrap font-mono text-foreground/70">
                    {entry.lovablePromptSnapshot}
                  </pre>
                </ScrollArea>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
