'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

type Feature = {
  id: string
  name: string
  category: string | null
  description?: string | null
  roadmapImplicationText?: string | null
}

type Product = { id: string; name: string }

interface Props {
  feature: Feature
  competitorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateRoadmapItemDialog({ feature, competitorName, open, onOpenChange }: Props) {
  const [products, setProducts] = React.useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [createdItemId, setCreatedItemId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setCreatedItemId(null)
    setTitle(feature.name)
    setCategory(feature.category ?? '')
    setDescription(
      `Competitive context: ${competitorName} has a feature "${feature.name}"${feature.category ? ` in the ${feature.category} category` : ''}.

Their approach: ${feature.description || 'Not specified'}

Roadmap signal: ${feature.roadmapImplicationText || 'Not specified'}

Why we should address this: This represents a competitive gap identified through intelligence gathering.`
    )
    fetch('/api/products').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setProducts(data)
        if (data.length > 0) setSelectedProductId(data[0].id)
      }
    })
  }, [open, feature, competitorName])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProductId || !title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          title,
          description,
          category: category || 'General',
          sourceType: 'COMPETITOR_GAP',
          isDraft: false,
        }),
      })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setCreatedItemId(item.id)
      toast.success('Roadmap item created')
    } catch { toast.error('Failed to create roadmap item') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Roadmap Item</DialogTitle>
        </DialogHeader>

        {createdItemId ? (
          <div className="py-6 space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <div>
              <p className="font-semibold">Roadmap item created!</p>
              <p className="text-sm text-muted-foreground mt-1">The competitive gap has been added to your roadmap.</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button asChild>
                <a href="/roadmap" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />View in Roadmap
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. AI / Automation" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                className="text-sm resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !selectedProductId || !title.trim()}>
                {saving ? 'Creating…' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
