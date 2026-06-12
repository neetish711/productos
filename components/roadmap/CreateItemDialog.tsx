'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
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

interface CreateItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: { id: string; name: string }[]
  defaultProductId?: string
  onCreated: (item: { id: string }) => void
}

const STATUS_OPTIONS = [
  { value: 'PROPOSED', label: 'Proposed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BACKLOG', label: 'Backlog' },
]

const CATEGORY_OPTIONS = [
  'General', 'Feature', 'Growth', 'Technical Debt',
  'Infrastructure', 'UX / Design', 'Integration', 'Analytics', 'Security',
]

const EMPTY = {
  title: '',
  description: '',
  category: 'General',
  status: 'PROPOSED',
  targetQuarter: '',
}

export function CreateItemDialog({
  open,
  onOpenChange,
  products,
  defaultProductId,
  onCreated,
}: CreateItemDialogProps) {
  const [form, setForm] = useState(EMPTY)
  const [productId, setProductId] = useState(defaultProductId ?? products[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  const handleClose = (val: boolean) => {
    if (saving) return
    if (!val) {
      setForm(EMPTY)
      setProductId(defaultProductId ?? products[0]?.id ?? '')
    }
    onOpenChange(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !productId) return
    setSaving(true)
    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          status: form.status,
          targetQuarter: form.targetQuarter.trim() || undefined,
          isDraft: false,
        }),
      })
      if (!res.ok) throw new Error('Failed to create item')
      const item = await res.json()
      toast.success('Item added to roadmap')
      onCreated(item)
      handleClose(false)
    } catch {
      toast.error('Could not create item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Roadmap Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {products.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="new-item-product">Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="new-item-product">
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-item-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-item-title"
              placeholder="Feature name or brief description"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-item-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger id="new-item-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-item-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="new-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-item-quarter">
              Timeframe <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="new-item-quarter"
              placeholder="e.g., Q3 2025"
              value={form.targetQuarter}
              onChange={(e) => set('targetQuarter', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-item-desc">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="new-item-desc"
              placeholder="Brief description of the feature or initiative"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim() || !productId} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
