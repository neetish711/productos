'use client'

import React, { useState, useMemo } from 'react'
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo, truncate } from '@/lib/utils'
import { VoiceInputButton } from '@/components/ui/voice-input-button'
import type { PRDComment } from './CommentPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  specId: string
  currentVersionId: string
  currentVersionNumber: number
  comments: PRDComment[]
  llmConfigs: { id: string; label: string; provider: string; defaultModel: string }[]
  onRegenerated: (versionId: string) => void
}

type Step = 'summary' | 'regenerating' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Issue type config (same as CommentPanel)
// ---------------------------------------------------------------------------

const ISSUE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  incorrect: { label: 'Incorrect', className: 'bg-red-100 text-red-800 border-red-200' },
  unclear: { label: 'Unclear', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  incomplete: { label: 'Incomplete', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  too_generic: { label: 'Too Generic', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  rewrite_needed: {
    label: 'Rewrite Needed',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  missing_edge_case: {
    label: 'Missing Edge Case',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  missing_acceptance_criteria: {
    label: 'Missing AC',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  business_issue: {
    label: 'Business Issue',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  technical_clarification: {
    label: 'Technical Clarification',
    className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
}

function getIssueTypeConfig(issueType: string) {
  return (
    ISSUE_TYPE_CONFIG[issueType] ?? {
      label: issueType,
      className: 'bg-secondary text-secondary-foreground border-border',
    }
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}

// ---------------------------------------------------------------------------
// Compact comment card for summary step
// ---------------------------------------------------------------------------

function SummaryCommentCard({
  comment,
  checked,
  onToggle,
}: {
  comment: PRDComment
  checked: boolean
  onToggle: (id: string, checked: boolean) => void
}) {
  const issueConfig = getIssueTypeConfig(comment.issueType)
  const severityColorClass =
    comment.severity === 'HIGH'
      ? 'bg-red-500'
      : comment.severity === 'MEDIUM'
      ? 'bg-yellow-500'
      : 'bg-green-500'

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border p-2.5 transition-colors',
        checked ? 'border-border' : 'border-border/40 opacity-50'
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onToggle(comment.id, val === true)}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium',
              issueConfig.className
            )}
          >
            {issueConfig.label}
          </span>
          <span
            className={cn('inline-block h-2 w-2 rounded-full shrink-0', severityColorClass)}
            title={comment.severity}
          />
          <span className="text-xs text-muted-foreground">{comment.sectionName}</span>
        </div>
        {comment.anchorText && (
          <p className="text-xs text-muted-foreground italic">
            &ldquo;{truncate(comment.anchorText, 60)}&rdquo;
          </p>
        )}
        <p className="text-xs text-foreground leading-snug">{truncate(comment.body, 120)}</p>
        <p className="text-xs text-muted-foreground">
          {comment.createdByName} · {timeAgo(comment.createdAt)}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 – Summary
// ---------------------------------------------------------------------------

interface SummaryStepProps {
  comments: PRDComment[]
  checkedIds: Set<string>
  onToggleComment: (id: string, checked: boolean) => void
  llmConfigs: RegenerationDialogProps['llmConfigs']
  llmConfigId: string
  onLlmConfigIdChange: (v: string) => void
  additionalInstructions: string
  onAdditionalInstructionsChange: (v: string) => void
  currentVersionNumber: number
  versionName: string
  onVersionNameChange: (v: string) => void
}

function SummaryStep({
  comments,
  checkedIds,
  onToggleComment,
  llmConfigs,
  llmConfigId,
  onLlmConfigIdChange,
  additionalInstructions,
  onAdditionalInstructionsChange,
  currentVersionNumber,
  versionName,
  onVersionNameChange,
}: SummaryStepProps) {
  const openComments = comments.filter((c) => c.status !== 'RESOLVED')
  const bySection = groupBy(openComments, (c) => c.sectionName)
  const byIssueType = groupBy(openComments, (c) => c.issueType)
  const selectedCount = checkedIds.size

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{openComments.length}</span>
          <span className="text-sm text-muted-foreground">
            open comment{openComments.length !== 1 ? 's' : ''} on v{currentVersionNumber}
          </span>
        </div>

        {/* By section */}
        {Object.keys(bySection).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">By section</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(bySection).map(([section, items]) => (
                <div
                  key={section}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5"
                >
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                    {section}
                  </span>
                  <Badge variant="secondary" className="text-xs py-0 px-1 h-4 ml-0.5">
                    {items.length}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By issue type */}
        {Object.keys(byIssueType).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">By issue type</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byIssueType).map(([issueType, items]) => {
                const config = getIssueTypeConfig(issueType)
                return (
                  <span
                    key={issueType}
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
                      config.className
                    )}
                  >
                    {config.label}
                    <span className="font-bold">{items.length}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Selected count */}
        <p className="text-sm font-medium">
          Selected for next draft:{' '}
          <span className="text-primary">{selectedCount}</span> comment
          {selectedCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Comment list */}
      {openComments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Comments</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => openComments.forEach((c) => onToggleComment(c.id, true))}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => openComments.forEach((c) => onToggleComment(c.id, false))}
              >
                Deselect all
              </button>
            </div>
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-2 pr-2">
              {openComments.map((comment) => (
                <SummaryCommentCard
                  key={comment.id}
                  comment={comment}
                  checked={checkedIds.has(comment.id)}
                  onToggle={onToggleComment}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* LLM provider */}
      <div className="space-y-1.5">
        <Label htmlFor="regen-llm-provider">LLM provider</Label>
        {llmConfigs.length === 0 ? (
          <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground">
            Using default
          </div>
        ) : (
          <Select value={llmConfigId} onValueChange={onLlmConfigIdChange}>
            <SelectTrigger id="regen-llm-provider">
              <SelectValue placeholder="Using default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                <span className="text-muted-foreground">Using default</span>
              </SelectItem>
              {llmConfigs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.label}
                    <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">
                      {c.provider}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Additional instructions */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="regen-instructions">
            Additional instructions{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <VoiceInputButton
            onTranscript={(text) =>
              onAdditionalInstructionsChange(
                additionalInstructions ? `${additionalInstructions} ${text}` : text
              )
            }
          />
        </div>
        <Textarea
          id="regen-instructions"
          placeholder="e.g., Focus on mobile-first experience..."
          value={additionalInstructions}
          onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* Version name */}
      <div className="space-y-1.5">
        <Label htmlFor="regen-version-name">
          Version name <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="regen-version-name"
          placeholder="e.g., Initial Draft, PM Review v1..."
          value={versionName}
          onChange={(e) => onVersionNameChange(e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 – Regenerating
// ---------------------------------------------------------------------------

function RegeneratingStep({
  currentVersionNumber,
  selectedCount,
}: {
  currentVersionNumber: number
  selectedCount: number
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div>
        <p className="text-lg font-semibold">Regenerating PRD...</p>
        <p className="text-sm text-muted-foreground mt-1">
          Based on v{currentVersionNumber} with {selectedCount} comment
          {selectedCount !== 1 ? 's' : ''}
        </p>
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        This may take a minute. Please wait.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 – Done
// ---------------------------------------------------------------------------

function DoneStep({
  newVersionNumber,
  onView,
}: {
  newVersionNumber: number
  onView: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
      <CheckCircle2 className="h-14 w-14 text-green-500" />
      <div>
        <p className="text-xl font-semibold">PRD Regenerated!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Version <span className="font-medium text-foreground">v{newVersionNumber}</span> is ready
          to review.
        </p>
      </div>
      <Button onClick={onView} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        View New Version
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
      <AlertCircle className="h-14 w-14 text-destructive" />
      <div>
        <p className="text-lg font-semibold">Regeneration failed</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{message}</p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RegenerationDialog({
  open,
  onOpenChange,
  specId,
  currentVersionId,
  currentVersionNumber,
  comments,
  llmConfigs,
  onRegenerated,
}: RegenerationDialogProps) {
  const [step, setStep] = useState<Step>('summary')
  const [llmConfigId, setLlmConfigId] = useState('__default__')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [versionName, setVersionName] = useState('')
  const [newVersionId, setNewVersionId] = useState('')
  const [newVersionNumber, setNewVersionNumber] = useState(currentVersionNumber + 1)
  const [errorMessage, setErrorMessage] = useState('')

  // Initialise checked IDs: open comments with includeInRegeneration=true
  const defaultCheckedIds = useMemo<Set<string>>(
    () =>
      new Set(
        comments
          .filter((c) => c.status !== 'RESOLVED' && c.includeInRegeneration)
          .map((c) => c.id)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [checkedIds, setCheckedIds] = useState<Set<string>>(defaultCheckedIds)

  const isRegenerating = step === 'regenerating'

  const handleOpenChange = (val: boolean) => {
    if (isRegenerating) return
    if (!val) {
      setStep('summary')
      setLlmConfigId('__default__')
      setAdditionalInstructions('')
      setVersionName('')
      setNewVersionId('')
      setErrorMessage('')
      setCheckedIds(defaultCheckedIds)
    }
    onOpenChange(val)
  }

  const handleToggleComment = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleRegenerate = async () => {
    setStep('regenerating')
    setErrorMessage('')
    try {
      const body = {
        parentVersionId: currentVersionId,
        commentIds: Array.from(checkedIds),
        llmConfigId: llmConfigId === '__default__' ? undefined : llmConfigId,
        additionalInstructions: additionalInstructions.trim() || undefined,
        versionName: versionName.trim() || undefined,
      }
      const res = await fetch(`/api/specs/${specId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Regeneration failed')
      }
      const data = await res.json()
      const versionId: string = data?.version?.id
      const versionNumber: number = data?.version?.versionNumber ?? currentVersionNumber + 1
      if (!versionId) throw new Error('Invalid response from server')
      setNewVersionId(versionId)
      setNewVersionNumber(versionNumber)
      setStep('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMessage(msg)
      setStep('error')
      toast.error(msg)
    }
  }

  const handleView = () => {
    onRegenerated(newVersionId)
    handleOpenChange(false)
  }

  const openComments = comments.filter((c) => c.status !== 'RESOLVED')

  const renderContent = () => {
    switch (step) {
      case 'summary':
        return (
          <SummaryStep
            comments={comments}
            checkedIds={checkedIds}
            onToggleComment={handleToggleComment}
            llmConfigs={llmConfigs}
            llmConfigId={llmConfigId}
            onLlmConfigIdChange={setLlmConfigId}
            additionalInstructions={additionalInstructions}
            onAdditionalInstructionsChange={setAdditionalInstructions}
            currentVersionNumber={currentVersionNumber}
            versionName={versionName}
            onVersionNameChange={setVersionName}
          />
        )
      case 'regenerating':
        return (
          <RegeneratingStep
            currentVersionNumber={currentVersionNumber}
            selectedCount={checkedIds.size}
          />
        )
      case 'done':
        return <DoneStep newVersionNumber={newVersionNumber} onView={handleView} />
      case 'error':
        return <ErrorState message={errorMessage} onRetry={() => setStep('summary')} />
    }
  }

  const renderFooter = () => {
    if (step === 'summary') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={openComments.length > 0 && checkedIds.size === 0}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
        </DialogFooter>
      )
    }
    if (step === 'error') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => setStep('summary')}>Back to summary</Button>
        </DialogFooter>
      )
    }
    if (step === 'done') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      )
    }
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Regenerate PRD</DialogTitle>
          {step === 'summary' && (
            <p className="text-sm text-muted-foreground">
              Review feedback from v{currentVersionNumber} before generating the next draft.
            </p>
          )}
        </DialogHeader>

        <div className="min-h-[300px]">{renderContent()}</div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  )
}
