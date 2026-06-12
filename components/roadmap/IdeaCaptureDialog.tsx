'use client'

import React, { useEffect, useState } from 'react'
import { Lightbulb, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceInputButton } from '@/components/ui/voice-input-button'

interface Product {
  id: string
  name: string
}

const CATEGORY_OPTIONS = [
  'General',
  'Feature',
  'Growth',
  'Technical Debt',
  'Infrastructure',
  'UX / Design',
  'Integration',
  'Analytics',
  'Security',
  'Other',
]

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'MANUAL', label: 'Personal / Internal' },
  { value: 'ACCOUNT_FEEDBACK', label: 'Customer Feedback' },
  { value: 'COMPETITOR_GAP', label: 'Competitive Analysis' },
  { value: 'VOICE_INPUT', label: 'Voice Note' },
]

const PRIORITY_OPTIONS: { value: string; label: string; impact: number }[] = [
  { value: 'LOW', label: 'Low', impact: 2 },
  { value: 'MEDIUM', label: 'Medium', impact: 5 },
  { value: 'HIGH', label: 'High', impact: 8 },
]

interface IdeaCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

const EMPTY_FORM = {
  productId: '',
  title: '',
  description: '',
  category: 'General',
  sourceType: 'MANUAL',
  priority: 'MEDIUM',
  notes: '',
}

export function IdeaCaptureDialog({ open, onOpenChange, onCreated }: IdeaCaptureDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)

  // Fetch products when dialog opens
  useEffect(() => {
    if (!open) return
    fetch('/api/products')
      .then((r) => r.json())
      .then((data: Product[]) => {
        setProducts(data)
        if (data.length === 1) setForm((f) => ({ ...f, productId: data[0].id }))
      })
      .catch(() => {})
  }, [open])

  const handleClose = (val: boolean) => {
    if (saving) return
    if (!val) setForm(EMPTY_FORM)
    onOpenChange(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.productId) return
    setSaving(true)
    try {
      const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === form.priority)
      const body = {
        productId: form.productId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        sourceType: form.sourceType,
        isDraft: true,
        isAiSuggested: false,
        riceReach: 0,
        riceImpact: priorityOpt?.impact ?? 5,
        riceConfidence: 50,
        riceEffort: 1,
        aiRationale: form.notes.trim() || undefined,
      }
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save idea')
      toast.success('Idea captured!')
      onCreated?.()
      handleClose(false)
    } catch {
      toast.error('Could not save idea. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Capture an Idea
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Rough ideas live separately from your roadmap until you decide to promote them.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product — only show when multiple products */}
          {products.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="idea-product">Product</Label>
              <Select value={form.productId} onValueChange={(v) => set('productId', v)}>
                <SelectTrigger id="idea-product">
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">
              Idea title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="idea-title"
              placeholder="e.g., In-app onboarding checklist"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Problem / Opportunity */}
          <div className="space-y-1.5">
            <Label htmlFor="idea-desc">
              Problem or opportunity{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="idea-desc"
              placeholder="What problem does this solve? Who benefits?"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Category + Source side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="idea-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger id="idea-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="idea-source">Source</Label>
              <Select value={form.sourceType} onValueChange={(v) => set('sourceType', v)}>
                <SelectTrigger id="idea-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="idea-priority">Priority guess</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger id="idea-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="idea-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <VoiceInputButton
                onTranscript={(text) =>
                  set('notes', form.notes ? `${form.notes} ${text}` : text)
                }
              />
            </div>
            <Textarea
              id="idea-notes"
              placeholder="Any additional context, links, or thoughts…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.title.trim() || !form.productId}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Idea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
