'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

function AddUpdateButton({ accountId }: { accountId: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    summaryText: '', feedbackText: '', sentiment: 'NEUTRAL', urgencyLevel: 'LOW',
    featureRequestsText: '', issuesText: '',
  })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${accountId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          featureRequestsJson: form.featureRequestsText.split('\n').map((s) => s.trim()).filter(Boolean),
          issuesJson: form.issuesText.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Update added')
      setOpen(false)
      router.refresh()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Update</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Account Update</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Summary</Label><Textarea value={form.summaryText} onChange={(e) => setForm({ ...form, summaryText: e.target.value })} placeholder="What happened in this update?" rows={3} /></div>
            <div className="space-y-1.5"><Label>Feedback / Notes</Label><Textarea value={form.feedbackText} onChange={(e) => setForm({ ...form, feedbackText: e.target.value })} placeholder="Additional feedback or notes..." rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sentiment</Label>
                <Select value={form.sentiment} onValueChange={(v) => setForm({ ...form, sentiment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'].map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={form.urgencyLevel} onValueChange={(v) => setForm({ ...form, urgencyLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((u) => <SelectItem key={u} value={u}>{u.charAt(0) + u.slice(1).toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Feature Requests (one per line)</Label><Textarea value={form.featureRequestsText} onChange={(e) => setForm({ ...form, featureRequestsText: e.target.value })} placeholder="Custom dashboards&#10;API access&#10;SSO support" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AccountDetailClient({ account }: { account: any }) {
  return null // Edit button placeholder
}
AccountDetailClient.AddUpdateButton = AddUpdateButton

export { AccountDetailClient }
