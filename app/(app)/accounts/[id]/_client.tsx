'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const HEALTH_OPTIONS = ['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED'] as const
const CADENCE_OPTIONS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE'] as const

function humanize(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')
}

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

// AUDIT S3-6: real edit modal wired to PUT /api/accounts/[id] (previously a
// null placeholder, so accounts could be created but never edited).
function AccountDetailClient({ account }: { account: any }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    name: account.name ?? '',
    healthStatus: account.healthStatus ?? 'NEW',
    csmName: account.csmName ?? '',
    csmEmail: account.csmEmail ?? '',
    meetingCadence: account.meetingCadence ?? 'MONTHLY',
    notesText: account.notesText ?? '',
    risksText: account.risksText ?? '',
    openAsksText: account.openAsksText ?? '',
  })

  async function save() {
    if (!form.name.trim()) { toast.error('Account name is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to save')
      }
      toast.success('Account updated')
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1" />Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Health</Label>
                <Select value={form.healthStatus} onValueChange={(v) => setForm({ ...form, healthStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HEALTH_OPTIONS.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Meeting Cadence</Label>
                <Select value={form.meetingCadence} onValueChange={(v) => setForm({ ...form, meetingCadence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CADENCE_OPTIONS.map((c) => <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>CSM Name</Label><Input value={form.csmName} onChange={(e) => setForm({ ...form, csmName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CSM Email</Label><Input type="email" value={form.csmEmail} onChange={(e) => setForm({ ...form, csmEmail: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notesText} onChange={(e) => setForm({ ...form, notesText: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5"><Label>Risks</Label><Textarea value={form.risksText} onChange={(e) => setForm({ ...form, risksText: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5"><Label>Open Asks</Label><Textarea value={form.openAsksText} onChange={(e) => setForm({ ...form, openAsksText: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
AccountDetailClient.AddUpdateButton = AddUpdateButton

export { AccountDetailClient }
