'use client'

import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table/DataTable'
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Building2, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

type Account = {
  id: string; name: string; healthStatus: string; csmName: string
  meetingCadence: string; _count: { updates: number }; updatedAt: Date
}

const healthConfig: Record<string, { label: string; variant: any }> = {
  NEW: { label: 'New', variant: 'info' },
  HEALTHY: { label: 'Healthy', variant: 'success' },
  AT_RISK: { label: 'At Risk', variant: 'warning' },
  CRITICAL: { label: 'Critical', variant: 'destructive' },
  CHURNED: { label: 'Churned', variant: 'outline' },
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  healthStatus: z.enum(['NEW', 'HEALTHY', 'AT_RISK', 'CRITICAL', 'CHURNED']).default('NEW'),
  csmName: z.string().default(''),
  csmEmail: z.string().optional(),
  meetingCadence: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE']).default('MONTHLY'),
})

export function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter()
  const [accounts, setAccounts] = React.useState(initialAccounts)
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', healthStatus: 'NEW', meetingCadence: 'MONTHLY', csmName: '' } })

  async function load() {
    const res = await fetch('/api/accounts')
    if (res.ok) setAccounts(await res.json())
  }

  async function onSubmit(values: any) {
    setSaving(true)
    try {
      const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      if (!res.ok) throw new Error()
      toast.success('Account added')
      setOpen(false)
      reset()
      load()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`Delete account "${name}"?`)) return
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() }
    else toast.error('Failed to delete')
  }

  const columns: ColumnDef<Account>[] = [
    { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />, cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span> },
    { accessorKey: 'healthStatus', header: ({ column }) => <DataTableColumnHeader column={column} title="Health" />, cell: ({ row }) => { const h = healthConfig[row.getValue('healthStatus') as string]; return h ? <Badge variant={h.variant}>{h.label}</Badge> : null } },
    { accessorKey: 'csmName', header: 'CSM', cell: ({ row }) => <span className="text-sm">{(row.getValue('csmName') as string) || '—'}</span> },
    { accessorKey: 'meetingCadence', header: 'Cadence', cell: ({ row }) => <span className="text-sm text-muted-foreground">{(row.getValue('meetingCadence') as string).toLowerCase()}</span> },
    { id: 'updates', header: 'Updates', cell: ({ row }) => <Badge variant="secondary">{row.original._count.updates}</Badge> },
    { id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/accounts/${row.original.id}`)}><Eye className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccount(row.original.id, row.original.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ]

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Accounts</h1><p className="text-muted-foreground text-sm">{accounts.length} client{accounts.length !== 1 ? 's' : ''}</p></div>
        <Button onClick={() => { reset(); setOpen(true) }}><Plus className="h-4 w-4 mr-1" />Add Account</Button>
      </div>

      <DataTable
        columns={columns} data={accounts} searchKey="name" searchPlaceholder="Search accounts..."
        onRowClick={(row) => router.push(`/accounts/${row.id}`)}
        emptyState={<div className="flex flex-col items-center gap-3 py-12"><Building2 className="h-12 w-12 text-muted-foreground/40" /><p className="font-medium">No accounts yet</p><p className="text-sm text-muted-foreground">Track your key clients to monitor health and feedback.</p><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add First Account</Button></div>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5"><Label>Account Name *</Label><Input {...register('name')} placeholder="e.g. Stripe" />{errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Health Status</Label>
                <Select defaultValue="NEW" onValueChange={(v) => setValue('healthStatus', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(healthConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Meeting Cadence</Label>
                <Select defaultValue="MONTHLY" onValueChange={(v) => setValue('meetingCadence', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'NONE'].map((c) => <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>CSM Name</Label><Input {...register('csmName')} placeholder="Sarah Johnson" /></div>
            <div className="space-y-1.5"><Label>CSM Email</Label><Input {...register('csmEmail')} type="email" placeholder="sarah@company.com" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add Account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
