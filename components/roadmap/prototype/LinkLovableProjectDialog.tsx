'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Link2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  itemId: string
  publishId: string
  onLinked: (lovableProjectUrl: string) => void
}

export function LinkLovableProjectDialog({ open, onClose, itemId, publishId, onLinked }: Props) {
  const [url, setUrl]       = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!url.trim()) return
    if (!url.startsWith('http')) {
      toast.error('Please enter a valid URL starting with http')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/roadmap/${itemId}/lovable/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishId, lovableProjectUrl: url.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to link')
      toast.success('Lovable project linked!')
      onLinked(url.trim())
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to link Lovable project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-teal-500" />
            Link Lovable Project
          </DialogTitle>
          <DialogDescription>
            Paste the URL of the Lovable project you created for this feature.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lovable-url">Lovable Project URL</Label>
            <Input
              id="lovable-url"
              placeholder="https://lovable.dev/projects/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Lovable project settings or the browser address bar.
            </p>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />Preview URL
            </a>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!url.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Link Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
