'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const SOURCE_TYPES = [
  { value: 'WEBSITE', label: 'Main Website' },
  { value: 'PRICING', label: 'Pricing Page' },
  { value: 'DOCS', label: 'Documentation' },
  { value: 'BLOG', label: 'Blog' },
  { value: 'RELEASE_NOTES', label: 'Release Notes / Changelog' },
  { value: 'INTEGRATIONS', label: 'Integrations Page' },
  { value: 'TRUST', label: 'Security / Trust' },
  { value: 'GITHUB', label: 'GitHub' },
  { value: 'REDDIT', label: 'Reddit' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'PRODUCT_HUNT', label: 'Product Hunt' },
  { value: 'NEWS', label: 'News / Press' },
  { value: 'CUSTOM', label: 'Custom' },
]

const FREQUENCIES = [
  { value: 'MANUAL', label: 'Manual only' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
]

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitorId: string
  onAdded: (source: Record<string, unknown>) => void
}

export function AddSourceDialog({ open, onOpenChange, competitorId, onAdded }: AddSourceDialogProps) {
  const [url, setUrl] = useState('')
  const [sourceType, setSourceType] = useState('WEBSITE')
  const [label, setLabel] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [crawlFrequency, setCrawlFrequency] = useState('WEEKLY')
  const [crawlDepth, setCrawlDepth] = useState(2)
  const [includePaths, setIncludePaths] = useState('')
  const [excludePaths, setExcludePaths] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!url.trim()) { toast.error('URL is required'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          sourceType,
          label: label.trim() || undefined,
          priority,
          crawlFrequency,
          crawlDepth,
          includePaths: includePaths.trim() || undefined,
          excludePaths: excludePaths.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (res.status === 409) { toast.error('A source with this URL already exists'); return }
      if (!res.ok) { const e = await res.json(); toast.error(e.error ?? 'Failed to add source'); return }
      const source = await res.json()
      toast.success('Source added')
      onAdded(source)
      onOpenChange(false)
      // Reset
      setUrl(''); setLabel(''); setSourceType('WEBSITE'); setPriority('NORMAL')
      setCrawlFrequency('WEEKLY'); setCrawlDepth(2); setIncludePaths(''); setExcludePaths(''); setNotes('')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Source</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="src-url">URL <span className="text-destructive">*</span></Label>
            <Input id="src-url" placeholder="https://competitor.com/pricing" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-label">Label</Label>
              <Input id="src-label" placeholder="e.g. Pricing Page" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select value={crawlFrequency} onValueChange={setCrawlFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-depth">Crawl Depth</Label>
              <Input
                id="src-depth"
                type="number"
                min={1}
                max={10}
                value={crawlDepth}
                onChange={(e) => setCrawlDepth(parseInt(e.target.value) || 2)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="src-include">Include Paths</Label>
              <Textarea
                id="src-include"
                placeholder="/docs/**&#10;/blog/**"
                className="text-xs h-20 resize-none"
                value={includePaths}
                onChange={(e) => setIncludePaths(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-exclude">Exclude Paths</Label>
              <Textarea
                id="src-exclude"
                placeholder="/legal/**&#10;/careers/**"
                className="text-xs h-20 resize-none"
                value={excludePaths}
                onChange={(e) => setExcludePaths(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-notes">Notes</Label>
            <Input id="src-notes" placeholder="Optional notes about this source" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Adding…' : 'Add Source'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
