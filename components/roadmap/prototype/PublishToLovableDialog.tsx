'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, Copy, ExternalLink, Check, AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  itemId: string
  itemTitle: string
  specVersion: number | null
  onPublished: (data: { publishId: string; publishVersion: number; prompt: string; specVersion: number }) => void
}

export function PublishToLovableDialog({ open, onClose, itemId, itemTitle, specVersion, onPublished }: Props) {
  const [step, setStep]           = useState<'idle' | 'generating' | 'preview'>('idle')
  const [prompt, setPrompt]       = useState('')
  const [publishId, setPublishId] = useState('')
  const [pubVersion, setPubVersion] = useState(0)
  const [copied, setCopied]       = useState(false)

  const handleGenerate = async () => {
    setStep('generating')
    try {
      const res = await fetch(`/api/roadmap/${itemId}/lovable/prepare`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to generate prompt')
      }
      const data = await res.json()
      setPrompt(data.prompt)
      setPublishId(data.publishId)
      setPubVersion(data.publishVersion)
      setStep('preview')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate Lovable prompt')
      setStep('idle')
    }
  }

  const handleCopyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      window.open('https://lovable.dev', '_blank', 'noopener,noreferrer')
      onPublished({ publishId, publishVersion: pubVersion, prompt, specVersion: specVersion ?? 0 })
      toast.success('Prompt copied! Paste it into your new Lovable project.')
      onClose()
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleClose = () => {
    setStep('idle')
    setPrompt('')
    setPublishId('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Publish to Lovable
          </DialogTitle>
          <DialogDescription>
            Transform the approved PRD into a Lovable-ready prompt for{' '}
            <span className="font-medium text-foreground">{itemTitle}</span>
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">What happens when you click Generate:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>The approved PRD (v{specVersion ?? '?'}) is parsed for UI-relevant sections</li>
                <li>A structured Lovable prompt is assembled from your PRD content</li>
                <li>You preview and copy the prompt, then paste it into a new Lovable project</li>
                <li>Return here to link your Lovable project URL back to this roadmap item</li>
              </ol>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                The raw PRD text is not sent to Lovable. A transformation layer extracts only
                UI-relevant information and structures it for frontend generation.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Generate Lovable Prompt
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm font-medium">Transforming PRD into Lovable prompt…</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Extracting UI structure, flows, forms, and states from your approved spec
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lovable Prompt — Version #{pubVersion}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generated from Spec v{specVersion}. Review below, then copy and paste into Lovable.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 text-xs font-medium">
                {Math.ceil(prompt.length / 4).toLocaleString()} tokens est.
              </span>
            </div>

            <ScrollArea className="h-64 rounded-lg border bg-muted/20">
              <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80">
                {prompt}
              </pre>
            </ScrollArea>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Next steps:</span> Click the button below to copy this
                prompt and open Lovable. Create a new project, paste the prompt, and let Lovable generate
                your prototype. Then come back and link the Lovable project URL to this roadmap item.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCopyAndOpen} className="gap-2">
                {copied
                  ? <><Check className="h-3.5 w-3.5" />Copied!</>
                  : <><Copy className="h-3.5 w-3.5" />Copy Prompt &amp; Open Lovable<ExternalLink className="h-3 w-3 ml-1" /></>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
