'use client'

import React, { useState } from 'react'
import { Check, Pencil, X, GitBranch, Trash2, GitCompare } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecVersion {
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

export interface VersionHistoryProps {
  specId: string
  versions: SpecVersion[]
  currentVersionId: string
  activeVersionId: string
  lifecycleState: string
  approvedVersionId?: string | null
  canDelete?: boolean
  onSelectVersion: (version: SpecVersion) => void
  onVersionRenamed: (versionId: string, name: string) => void
  onVersionDeleted?: (versionId: string) => void
  onCompare?: (versionId: string) => void
}

// ---------------------------------------------------------------------------
// Lifecycle badge for version cards
// ---------------------------------------------------------------------------

function VersionLifecycleBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-600 border-gray-300' },
    IN_REVIEW: { label: 'In Review', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    NEEDS_REVISION: { label: 'Needs Revision', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
    ARCHIVED: { label: 'Archived', className: 'bg-gray-100 text-gray-500 border-gray-300' },
  }
  const c = config[state]
  if (!c) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0 text-[10px] font-medium leading-4 h-4',
        c.className
      )}
    >
      {state === 'APPROVED' && <Check className="h-2.5 w-2.5" />}
      {c.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Generation mode badge
// ---------------------------------------------------------------------------

function GenerationModeBadge({ mode }: { mode: string }) {
  if (mode === 'FRESH_DRAFT') {
    return (
      <Badge
        variant="outline"
        className="text-xs py-0 px-1.5 h-4 bg-blue-50 text-blue-700 border-blue-200"
      >
        Fresh Draft
      </Badge>
    )
  }
  if (mode === 'REGENERATION') {
    return (
      <Badge
        variant="outline"
        className="text-xs py-0 px-1.5 h-4 bg-purple-50 text-purple-700 border-purple-200"
      >
        Regeneration
      </Badge>
    )
  }
  if (mode === 'MANUAL_EDIT') {
    return (
      <Badge
        variant="outline"
        className="text-xs py-0 px-1.5 h-4 bg-gray-100 text-gray-600 border-gray-300"
      >
        Manual Edit
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">
      {mode}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Inline name editor
// ---------------------------------------------------------------------------

interface InlineNameEditorProps {
  specId: string
  versionId: string
  currentName: string | null | undefined
  onRenamed: (versionId: string, name: string) => void
}

function InlineNameEditor({ specId, versionId, currentName, onRenamed }: InlineNameEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentName ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    const trimmed = value.trim()
    setSaving(true)
    try {
      const res = await fetch(`/api/specs/${specId}/versions/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionName: trimmed }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to rename version')
      }
      onRenamed(versionId, trimmed)
      setEditing(false)
      toast.success('Version renamed')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename version')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(currentName ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="group flex items-center gap-1 text-left"
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        title="Rename version"
      >
        <span className="text-sm font-medium text-foreground truncate max-w-[160px]">
          {currentName || <span className="text-muted-foreground italic">Unnamed</span>}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') handleCancel()
        }}
        className="h-6 text-xs px-2 w-36"
        disabled={saving}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
        onClick={handleSave}
        disabled={saving}
      >
        <Check className="h-3 w-3" />
        <span className="sr-only">Save</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        onClick={handleCancel}
        disabled={saving}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Cancel</span>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Version card
// ---------------------------------------------------------------------------

interface VersionCardProps {
  version: SpecVersion
  specId: string
  isSelected: boolean
  isCurrent: boolean
  isApproved: boolean
  isOnlyVersion: boolean
  currentLifecycleState: string
  canDelete: boolean
  onClick: () => void
  onVersionRenamed: (versionId: string, name: string) => void
  onVersionDeleted?: (versionId: string) => void
  onCompare?: (versionId: string) => void
}

function VersionCard({
  version,
  specId,
  isSelected,
  isCurrent,
  isApproved,
  isOnlyVersion,
  currentLifecycleState,
  canDelete,
  onClick,
  onVersionRenamed,
  onVersionDeleted,
  onCompare,
}: VersionCardProps) {
  const isAI = version.generationMode !== 'MANUAL_EDIT'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canDeleteThis = canDelete && !isCurrent && !isApproved && !isOnlyVersion

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/specs/${version.specId}/versions/${version.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to delete version')
      }
      toast.success(`v${version.version} deleted`)
      onVersionDeleted?.(version.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete version')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-md border p-3 space-y-2 cursor-pointer transition-colors select-none',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
      )}
    >
      {/* Top row: version number + badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={isCurrent ? 'default' : 'secondary'} className="text-xs">
          v{version.version}
        </Badge>
        {isCurrent && (
          <Badge
            variant="outline"
            className="text-xs py-0 px-1.5 h-4 bg-green-50 text-green-700 border-green-200"
          >
            Current
          </Badge>
        )}
        <GenerationModeBadge mode={version.generationMode} />

        {/* Lifecycle annotation — show on current version or approved version */}
        {isApproved && <VersionLifecycleBadge state="APPROVED" />}
        {isCurrent && !isApproved && currentLifecycleState !== 'DRAFT' && (
          <VersionLifecycleBadge state={currentLifecycleState} />
        )}

        {/* Compare + Delete actions — pushed to the right */}
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onCompare && !isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Compare with current"
              onClick={(e) => {
                e.stopPropagation()
                onCompare(version.id)
              }}
            >
              <GitCompare className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-destructive font-medium">Delete?</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                  disabled={deleting || !canDeleteThis}
                  title={
                    !canDeleteThis
                      ? isCurrent ? 'Cannot delete current version'
                        : isApproved ? 'Cannot delete approved version'
                        : isOnlyVersion ? 'Cannot delete the only version'
                        : 'Cannot delete'
                      : 'Confirm delete'
                  }
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 p-0',
                  canDeleteThis
                    ? 'text-muted-foreground hover:text-destructive'
                    : 'text-muted-foreground/30 cursor-not-allowed'
                )}
                title={
                  !canDeleteThis
                    ? isCurrent ? 'Cannot delete current version'
                      : isApproved ? 'Cannot delete approved version'
                      : isOnlyVersion ? 'Cannot delete the only version'
                      : 'Cannot delete'
                    : 'Delete version'
                }
                onClick={(e) => {
                  e.stopPropagation()
                  if (canDeleteThis) setConfirmDelete(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )
          )}
        </div>
      </div>

      {/* Editable version name */}
      <InlineNameEditor
        specId={specId}
        versionId={version.id}
        currentName={version.versionName}
        onRenamed={onVersionRenamed}
      />

      {/* AI model info */}
      {isAI && version.provider && version.model && (
        <p className="text-xs text-muted-foreground">
          {version.provider} · {version.model}
        </p>
      )}

      {/* Comments applied (only for regenerations) */}
      {version.generationMode === 'REGENERATION' && version.commentsApplied > 0 && (
        <p className="text-xs text-muted-foreground">
          {version.commentsApplied} comment{version.commentsApplied !== 1 ? 's' : ''} applied
        </p>
      )}

      {/* Change summary */}
      {version.changeSummary && (
        <p className="text-xs text-muted-foreground truncate">{version.changeSummary}</p>
      )}

      {/* Meta: author + time */}
      <p className="text-xs text-muted-foreground">
        {version.changedBy?.name ?? 'Unknown'} · {timeAgo(version.createdAt)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lifecycle state summary banner at the top of the history panel
// ---------------------------------------------------------------------------

const LIFECYCLE_STEPS = ['DRAFT', 'IN_REVIEW', 'APPROVED'] as const
const LIFECYCLE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  NEEDS_REVISION: 'Needs Revision',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
}

function LifecycleFlowBar({ state }: { state: string }) {
  const isNeedsRevision = state === 'NEEDS_REVISION'
  const isArchived = state === 'ARCHIVED'

  const activeStep =
    state === 'APPROVED' ? 2
    : state === 'IN_REVIEW' || state === 'NEEDS_REVISION' ? 1
    : 0

  if (isArchived) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 mb-3">
        <span className="text-xs text-muted-foreground italic">This spec is archived.</span>
      </div>
    )
  }

  return (
    <div className="mb-4 px-1">
      <div className="flex items-center gap-1">
        {LIFECYCLE_STEPS.map((step, i) => {
          const isActive = activeStep === i
          const isDone = activeStep > i
          return (
            <React.Fragment key={step}>
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                  isDone
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : isActive
                    ? isNeedsRevision && step === 'IN_REVIEW'
                      ? 'bg-orange-50 border-orange-200 text-orange-700'
                      : 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/50 border-border text-muted-foreground'
                )}
              >
                {isDone && <Check className="h-2.5 w-2.5" />}
                {isActive && isNeedsRevision && step === 'IN_REVIEW'
                  ? 'Needs Revision'
                  : LIFECYCLE_LABELS[step]}
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <GitBranch
                  className={cn(
                    'h-3 w-3 shrink-0 rotate-90',
                    isDone ? 'text-green-400' : 'text-muted-foreground/40'
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
      {isNeedsRevision && (
        <p className="text-[11px] text-orange-600 mt-1.5 pl-1">
          Revision requested — update the spec and re-submit for review.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VersionHistory({
  specId,
  versions,
  currentVersionId,
  activeVersionId,
  lifecycleState,
  approvedVersionId,
  canDelete = false,
  onSelectVersion,
  onVersionRenamed,
  onVersionDeleted,
  onCompare,
}: VersionHistoryProps) {
  const [selectedId, setSelectedId] = useState<string>(activeVersionId)

  const sorted = [...versions].sort((a, b) => b.version - a.version)

  const handleSelect = (version: SpecVersion) => {
    setSelectedId(version.id)
    onSelectVersion(version)
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p className="text-sm">No version history yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Lifecycle progress bar */}
      <LifecycleFlowBar state={lifecycleState} />

      <p className="text-xs text-muted-foreground mb-2 px-1">
        {sorted.length} version{sorted.length !== 1 ? 's' : ''} — click any to preview in read mode
      </p>

      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-1">
          {sorted.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              specId={specId}
              isSelected={selectedId === version.id}
              isCurrent={version.id === currentVersionId}
              isApproved={!!approvedVersionId && version.id === approvedVersionId}
              isOnlyVersion={sorted.length <= 1}
              currentLifecycleState={lifecycleState}
              canDelete={canDelete}
              onClick={() => handleSelect(version)}
              onVersionRenamed={onVersionRenamed}
              onVersionDeleted={onVersionDeleted}
              onCompare={onCompare}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
