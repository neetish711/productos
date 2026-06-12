'use client'

import React, { useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { VoiceInputButton } from '@/components/ui/voice-input-button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  specId: string
  roadmapItem: {
    title: string
    category: string
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
  llmConfigs: { id: string; label: string; provider: string; defaultModel: string }[]
  onGenerated: (versionId: string) => void
}

type TemplateType = 'FULL_PRD' | 'LIGHTWEIGHT_PRD' | 'ENGINEERING_SPEC' | 'DISCOVERY_BRIEF'

const TEMPLATE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'FULL_PRD', label: 'Full PRD' },
  { value: 'LIGHTWEIGHT_PRD', label: 'Lightweight PRD' },
  { value: 'ENGINEERING_SPEC', label: 'Engineering Spec' },
  { value: 'DISCOVERY_BRIEF', label: 'Discovery Brief' },
]

type Step = 'configure' | 'preview' | 'generating' | 'done' | 'error'

interface ContextFlags {
  includeRice: boolean
  includeJira: boolean
  includeDependencies: boolean
  includeNotes: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTemplatLabel(value: TemplateType): string {
  return TEMPLATE_OPTIONS.find((t) => t.value === value)?.label ?? value
}

function hasRice(item: GenerationDialogProps['roadmapItem']): boolean {
  return (
    item.riceReach != null ||
    item.riceImpact != null ||
    item.riceConfidence != null ||
    item.riceEffort != null
  )
}

function formatRiceSummary(item: GenerationDialogProps['roadmapItem']): string {
  const parts: string[] = []
  if (item.riceReach != null) parts.push(`R:${item.riceReach}`)
  if (item.riceImpact != null) parts.push(`I:${item.riceImpact}`)
  if (item.riceConfidence != null) parts.push(`C:${item.riceConfidence}`)
  if (item.riceEffort != null) parts.push(`E:${item.riceEffort}`)
  if (item.priorityScore != null) parts.push(`Score:${item.priorityScore}`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Step 1 – Configure
// ---------------------------------------------------------------------------
interface ConfigureStepProps {
  roadmapItem: GenerationDialogProps['roadmapItem']
  llmConfigs: GenerationDialogProps['llmConfigs']
  templateType: TemplateType
  onTemplateTypeChange: (v: TemplateType) => void
  llmConfigId: string
  onLlmConfigIdChange: (v: string) => void
  additionalInstructions: string
  onAdditionalInstructionsChange: (v: string) => void
  contextFlags: ContextFlags
  onContextFlagChange: (key: keyof ContextFlags, value: boolean) => void
  versionName: string
  onVersionNameChange: (v: string) => void
}

function ConfigureStep({
  roadmapItem,
  llmConfigs,
  templateType,
  onTemplateTypeChange,
  llmConfigId,
  onLlmConfigIdChange,
  additionalInstructions,
  onAdditionalInstructionsChange,
  contextFlags,
  onContextFlagChange,
  versionName,
  onVersionNameChange,
}: ConfigureStepProps) {
  const riceAvailable = hasRice(roadmapItem)
  const jiraAvailable = !!roadmapItem.jiraKey
  const notesAvailable = !!roadmapItem.notes

  return (
    <div className="space-y-5">
      {/* Template type */}
      <div className="space-y-1.5">
        <Label htmlFor="template-type">Template type</Label>
        <Select
          value={templateType}
          onValueChange={(v) => onTemplateTypeChange(v as TemplateType)}
        >
          <SelectTrigger id="template-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* LLM provider */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-provider">LLM provider</Label>
        {llmConfigs.length === 0 ? (
          <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground">
            Using default
          </div>
        ) : (
          <Select value={llmConfigId} onValueChange={onLlmConfigIdChange}>
            <SelectTrigger id="llm-provider">
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
          <Label htmlFor="additional-instructions">
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
          id="additional-instructions"
          placeholder="e.g., Focus on mobile-first experience..."
          value={additionalInstructions}
          onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* Version name */}
      <div className="space-y-1.5">
        <Label htmlFor="version-name">
          Version name <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="version-name"
          placeholder="e.g., Initial Draft, PM Review v1..."
          value={versionName}
          onChange={(e) => onVersionNameChange(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Context toggles */}
      <div className="space-y-2">
        <Label>Include in context</Label>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={contextFlags.includeRice}
              onCheckedChange={(checked) =>
                onContextFlagChange('includeRice', checked === true)
              }
              disabled={!riceAvailable}
            />
            <span className={cn(!riceAvailable && 'text-muted-foreground')}>
              RICE scores
              {!riceAvailable && (
                <span className="ml-1 text-xs text-muted-foreground">(not available)</span>
              )}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={contextFlags.includeJira}
              onCheckedChange={(checked) =>
                onContextFlagChange('includeJira', checked === true)
              }
              disabled={!jiraAvailable}
            />
            <span className={cn(!jiraAvailable && 'text-muted-foreground')}>
              Jira key
              {!jiraAvailable && (
                <span className="ml-1 text-xs text-muted-foreground">(not available)</span>
              )}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={contextFlags.includeDependencies}
              onCheckedChange={(checked) =>
                onContextFlagChange('includeDependencies', checked === true)
              }
            />
            <span>Dependencies</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={contextFlags.includeNotes}
              onCheckedChange={(checked) =>
                onContextFlagChange('includeNotes', checked === true)
              }
              disabled={!notesAvailable}
            />
            <span className={cn(!notesAvailable && 'text-muted-foreground')}>
              Notes
              {!notesAvailable && (
                <span className="ml-1 text-xs text-muted-foreground">(not available)</span>
              )}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 – Context Preview
// ---------------------------------------------------------------------------
interface PreviewRowProps {
  label: string
  value: string | null | undefined
}

function PreviewRow({ label, value }: PreviewRowProps) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-32 shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

interface ContextPreviewStepProps {
  roadmapItem: GenerationDialogProps['roadmapItem']
  templateType: TemplateType
  llmConfigId: string
  llmConfigs: GenerationDialogProps['llmConfigs']
  additionalInstructions: string
  contextFlags: ContextFlags
}

function ContextPreviewStep({
  roadmapItem,
  templateType,
  llmConfigId,
  llmConfigs,
  additionalInstructions,
  contextFlags,
}: ContextPreviewStepProps) {
  const selectedConfig = llmConfigs.find((c) => c.id === llmConfigId)
  const modelLabel = selectedConfig
    ? `${selectedConfig.label} (${selectedConfig.provider})`
    : 'Default'

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Review the context that will be sent to the model.
      </p>
      <div className="rounded-md border bg-muted/30 p-4 space-y-2">
        <PreviewRow label="Feature" value={roadmapItem.title} />
        <PreviewRow label="Category" value={roadmapItem.category} />
        {roadmapItem.description && (
          <PreviewRow label="Description" value={roadmapItem.description} />
        )}
        {roadmapItem.targetQuarter && (
          <PreviewRow label="Quarter" value={roadmapItem.targetQuarter} />
        )}
        {roadmapItem.jiraKey && contextFlags.includeJira && (
          <PreviewRow label="Jira" value={roadmapItem.jiraKey} />
        )}
        {hasRice(roadmapItem) && contextFlags.includeRice && (
          <PreviewRow label="RICE" value={formatRiceSummary(roadmapItem)} />
        )}
        {roadmapItem.notes && contextFlags.includeNotes && (
          <PreviewRow label="Notes" value={roadmapItem.notes} />
        )}
        <div className="pt-1 border-t mt-2 space-y-2">
          <PreviewRow label="Template" value={getTemplatLabel(templateType)} />
          <PreviewRow label="Model" value={modelLabel} />
          {additionalInstructions && (
            <PreviewRow label="Instructions" value={additionalInstructions} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 – Generating
// ---------------------------------------------------------------------------
function GeneratingStep({
  templateType,
  llmConfigId,
  llmConfigs,
}: {
  templateType: TemplateType
  llmConfigId: string
  llmConfigs: GenerationDialogProps['llmConfigs']
}) {
  const selectedConfig = llmConfigs.find((c) => c.id === llmConfigId)
  const modelLabel = selectedConfig ? selectedConfig.label : 'Default model'

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div>
        <p className="text-lg font-semibold">Generating PRD...</p>
        <p className="text-sm text-muted-foreground mt-1">
          {getTemplatLabel(templateType)} · {modelLabel}
        </p>
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        This may take up to a minute depending on the template and model selected.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 – Done
// ---------------------------------------------------------------------------
function DoneStep({
  versionNumber,
  onView,
}: {
  versionNumber: number
  onView: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <CheckCircle2 className="h-14 w-14 text-green-500" />
      <div>
        <p className="text-xl font-semibold">PRD Generated!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Version <span className="font-medium text-foreground">v{versionNumber}</span> is ready to
          review.
        </p>
      </div>
      <Button onClick={onView} className="gap-2">
        <Sparkles className="h-4 w-4" />
        View PRD
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <AlertCircle className="h-14 w-14 text-destructive" />
      <div>
        <p className="text-lg font-semibold">Generation failed</p>
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

export function GenerationDialog({
  open,
  onOpenChange,
  specId,
  roadmapItem,
  llmConfigs,
  onGenerated,
}: GenerationDialogProps) {
  const [step, setStep] = useState<Step>('configure')
  const [templateType, setTemplateType] = useState<TemplateType>('FULL_PRD')
  const [llmConfigId, setLlmConfigId] = useState<string>('__default__')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [versionName, setVersionName] = useState('')
  const [contextFlags, setContextFlags] = useState<ContextFlags>({
    includeRice: hasRice(roadmapItem),
    includeJira: !!roadmapItem.jiraKey,
    includeDependencies: true,
    includeNotes: !!roadmapItem.notes,
  })
  const [generatedVersionId, setGeneratedVersionId] = useState('')
  const [generatedVersionNumber, setGeneratedVersionNumber] = useState(1)
  const [errorMessage, setErrorMessage] = useState('')

  const isGenerating = step === 'generating'

  const handleOpenChange = (val: boolean) => {
    if (isGenerating) return
    if (!val) {
      // Reset state on close
      setStep('configure')
      setTemplateType('FULL_PRD')
      setLlmConfigId('__default__')
      setAdditionalInstructions('')
      setVersionName('')
      setContextFlags({
        includeRice: hasRice(roadmapItem),
        includeJira: !!roadmapItem.jiraKey,
        includeDependencies: true,
        includeNotes: !!roadmapItem.notes,
      })
      setGeneratedVersionId('')
      setErrorMessage('')
    }
    onOpenChange(val)
  }

  const handleContextFlagChange = (key: keyof ContextFlags, value: boolean) => {
    setContextFlags((prev) => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async () => {
    setStep('generating')
    setErrorMessage('')
    try {
      const body = {
        llmConfigId: llmConfigId === '__default__' ? undefined : llmConfigId,
        templateType,
        additionalInstructions: additionalInstructions.trim() || undefined,
        versionName: versionName.trim() || undefined,
        contextFlags,
      }
      const res = await fetch(`/api/specs/${specId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Generation failed')
      }
      const data = await res.json()
      const versionId: string = data?.version?.id
      const versionNumber: number = data?.version?.versionNumber ?? 1
      if (!versionId) throw new Error('Invalid response from server')
      setGeneratedVersionId(versionId)
      setGeneratedVersionNumber(versionNumber)
      setStep('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMessage(msg)
      setStep('error')
      toast.error(msg)
    }
  }

  const handleView = () => {
    onGenerated(generatedVersionId)
    handleOpenChange(false)
  }

  const getStepLabel = (): string => {
    if (step === 'configure') return 'Step 1 of 2'
    if (step === 'preview') return 'Step 2 of 2'
    return ''
  }

  const renderContent = () => {
    switch (step) {
      case 'configure':
        return (
          <ConfigureStep
            roadmapItem={roadmapItem}
            llmConfigs={llmConfigs}
            templateType={templateType}
            onTemplateTypeChange={setTemplateType}
            llmConfigId={llmConfigId}
            onLlmConfigIdChange={setLlmConfigId}
            additionalInstructions={additionalInstructions}
            onAdditionalInstructionsChange={setAdditionalInstructions}
            contextFlags={contextFlags}
            onContextFlagChange={handleContextFlagChange}
            versionName={versionName}
            onVersionNameChange={setVersionName}
          />
        )
      case 'preview':
        return (
          <ContextPreviewStep
            roadmapItem={roadmapItem}
            templateType={templateType}
            llmConfigId={llmConfigId}
            llmConfigs={llmConfigs}
            additionalInstructions={additionalInstructions}
            contextFlags={contextFlags}
          />
        )
      case 'generating':
        return (
          <GeneratingStep
            templateType={templateType}
            llmConfigId={llmConfigId}
            llmConfigs={llmConfigs}
          />
        )
      case 'done':
        return (
          <DoneStep versionNumber={generatedVersionNumber} onView={handleView} />
        )
      case 'error':
        return (
          <ErrorState
            message={errorMessage}
            onRetry={() => setStep('preview')}
          />
        )
    }
  }

  const renderFooter = () => {
    if (step === 'configure') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => setStep('preview')}>Next</Button>
        </DialogFooter>
      )
    }
    if (step === 'preview') {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('configure')}>
            Back
          </Button>
          <Button onClick={handleGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
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
          <Button onClick={() => setStep('preview')}>Back to preview</Button>
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Generate PRD</DialogTitle>
            {getStepLabel() && (
              <span className="text-sm text-muted-foreground shrink-0">{getStepLabel()}</span>
            )}
          </div>
          {(step === 'configure' || step === 'preview') && (
            <p className="text-sm text-muted-foreground truncate pt-0.5">
              {roadmapItem.title}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-[280px]">{renderContent()}</div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  )
}
