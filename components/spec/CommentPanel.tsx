'use client'

import React, { useState } from 'react'
import { Trash2, CheckCheck, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, timeAgo, truncate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRDComment {
  id: string
  specVersionId: string
  anchorStart: number
  anchorEnd: number
  anchorText: string
  sectionName: string
  issueType: string
  severity: string
  body: string
  includeInRegeneration: boolean
  status: string
  actionType?: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface CommentPanelProps {
  specId: string
  versionId: string
  comments: PRDComment[]
  onCommentAdded: (comment: PRDComment) => void
  onCommentUpdated: (comment: PRDComment) => void
  onCommentDeleted: (commentId: string) => void
  activeCommentId?: string | null
  onCommentClick: (commentId: string) => void
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Issue type config
// ---------------------------------------------------------------------------

const ISSUE_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  incorrect: {
    label: 'Incorrect',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  unclear: {
    label: 'Unclear',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  incomplete: {
    label: 'Incomplete',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  too_generic: {
    label: 'Too Generic',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  rewrite_needed: {
    label: 'Rewrite Needed',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  missing_edge_case: {
    label: 'Missing Edge Case',
    className: 'bg-coral-100 text-[#b45309] bg-orange-50 border-orange-200',
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
      className: 'bg-secondary text-secondary-foreground',
    }
  )
}

// ---------------------------------------------------------------------------
// Severity dot
// ---------------------------------------------------------------------------

function SeverityDot({ severity }: { severity: string }) {
  const colorClass =
    severity === 'HIGH'
      ? 'bg-red-500'
      : severity === 'MEDIUM'
      ? 'bg-yellow-500'
      : 'bg-green-500'

  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', colorClass)}
      title={severity}
    />
  )
}

// ---------------------------------------------------------------------------
// Comment card
// ---------------------------------------------------------------------------

interface CommentCardProps {
  comment: PRDComment
  specId: string
  isActive: boolean
  onClick: () => void
  onUpdated: (comment: PRDComment) => void
  onDeleted: (commentId: string) => void
  readOnly: boolean
}

function CommentCard({
  comment,
  specId,
  isActive,
  onClick,
  onUpdated,
  onDeleted,
  readOnly,
}: CommentCardProps) {
  const [isTogglingRegen, setIsTogglingRegen] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isResolved = comment.status === 'RESOLVED'
  const issueConfig = getIssueTypeConfig(comment.issueType)

  const patchComment = async (payload: Partial<PRDComment>): Promise<PRDComment> => {
    const res = await fetch(`/api/specs/${specId}/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to update comment')
    }
    return res.json()
  }

  const handleToggleRegen = async (checked: boolean) => {
    setIsTogglingRegen(true)
    try {
      const updated = await patchComment({ includeInRegeneration: checked })
      onUpdated(updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update comment')
    } finally {
      setIsTogglingRegen(false)
    }
  }

  const handleResolve = async () => {
    setIsResolving(true)
    try {
      const updated = await patchComment({ status: 'RESOLVED' })
      onUpdated(updated)
      toast.success('Comment resolved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve comment')
    } finally {
      setIsResolving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/specs/${specId}/comments/${comment.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to delete comment')
      }
      onDeleted(comment.id)
      toast.success('Comment deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-md border p-3 space-y-2 cursor-pointer transition-colors',
        isActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/40',
        isResolved && 'opacity-60'
      )}
    >
      {/* Header row: issue type badge, severity dot, resolved badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
            issueConfig.className
          )}
        >
          {issueConfig.label}
        </span>
        <SeverityDot severity={comment.severity} />
        {isResolved && (
          <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4 ml-auto">
            Resolved
          </Badge>
        )}
      </div>

      {/* Section name */}
      <p className="text-xs text-muted-foreground font-medium">{comment.sectionName}</p>

      {/* Anchor text */}
      {comment.anchorText && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2">
          &ldquo;{truncate(comment.anchorText, 80)}&rdquo;
        </p>
      )}

      {/* Comment body */}
      <p className="text-sm text-foreground leading-snug">{comment.body}</p>

      {/* Meta */}
      <p className="text-xs text-muted-foreground">
        {comment.createdByName} · {timeAgo(comment.createdAt)}
      </p>

      {/* Action row */}
      {!readOnly && (
        <div
          className="flex items-center gap-3 pt-1 border-t border-border/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Include in regen toggle */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <Checkbox
              checked={comment.includeInRegeneration}
              onCheckedChange={(checked) => handleToggleRegen(checked === true)}
              disabled={isTogglingRegen || isResolved}
              className="h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Include in regen</span>
          </label>

          <div className="ml-auto flex items-center gap-1">
            {/* Resolve button (only for open comments) */}
            {!isResolved && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleResolve}
                disabled={isResolving}
              >
                <CheckCheck className="h-3 w-3" />
                Resolve
              </Button>
            )}

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comment list for a tab
// ---------------------------------------------------------------------------

function CommentList({
  comments,
  specId,
  activeCommentId,
  onCommentClick,
  onUpdated,
  onDeleted,
  readOnly,
  emptyMessage,
}: {
  comments: PRDComment[]
  specId: string
  activeCommentId?: string | null
  onCommentClick: (id: string) => void
  onUpdated: (comment: PRDComment) => void
  onDeleted: (commentId: string) => void
  readOnly: boolean
  emptyMessage: string
}) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-1">
        <RotateCcw className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <CommentCard
          key={c.id}
          comment={c}
          specId={specId}
          isActive={activeCommentId === c.id}
          onClick={() => onCommentClick(c.id)}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CommentPanel({
  specId,
  versionId: _versionId,
  comments,
  onCommentAdded: _onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
  activeCommentId,
  onCommentClick,
  readOnly = false,
}: CommentPanelProps) {
  const openComments = comments.filter((c) => c.status !== 'RESOLVED')
  const resolvedComments = comments.filter((c) => c.status === 'RESOLVED')
  const includedInRegenCount = openComments.filter((c) => c.includeInRegeneration).length

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{openComments.length}</span> open comment
          {openComments.length !== 1 ? 's' : ''}
          {' · '}
          <span className="font-medium text-foreground">{includedInRegenCount}</span> included in
          next regen
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="open" className="flex flex-col flex-1 min-h-0">
        <div className="px-3 pt-2 shrink-0">
          <TabsList className="w-full h-8 text-xs">
            <TabsTrigger value="open" className="flex-1 text-xs">
              Open ({openComments.length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex-1 text-xs">
              Resolved ({resolvedComments.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">
              All ({comments.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="open" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="px-3 py-2">
              <CommentList
                comments={openComments}
                specId={specId}
                activeCommentId={activeCommentId}
                onCommentClick={onCommentClick}
                onUpdated={onCommentUpdated}
                onDeleted={onCommentDeleted}
                readOnly={readOnly}
                emptyMessage="No open comments"
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resolved" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="px-3 py-2">
              <CommentList
                comments={resolvedComments}
                specId={specId}
                activeCommentId={activeCommentId}
                onCommentClick={onCommentClick}
                onUpdated={onCommentUpdated}
                onDeleted={onCommentDeleted}
                readOnly={readOnly}
                emptyMessage="No resolved comments"
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="px-3 py-2">
              <CommentList
                comments={comments}
                specId={specId}
                activeCommentId={activeCommentId}
                onCommentClick={onCommentClick}
                onUpdated={onCommentUpdated}
                onDeleted={onCommentDeleted}
                readOnly={readOnly}
                emptyMessage="No comments yet"
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
