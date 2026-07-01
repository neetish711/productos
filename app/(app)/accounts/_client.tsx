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
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Building2, Eye, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Papa from 'papaparse'

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

  // AUDIT S4-acct: bulk delete + bulk status change (loops the existing per-id routes).
  async function bulkDelete(rows: Account[]) {
    if (!confirm(`Delete ${rows.length} account(s)?`)) return
    await Promise.all(rows.map((r) => fetch(`/api/accounts/${r.id}`, { method: 'DELETE' })))
    toast.success(`Deleted ${rows.length} account(s)`)
    load()
  }
  async function bulkSetHealth(rows: Account[], healthStatus: string) {
    await Promise.all(rows.map((r) => fetch(`/api/accounts/${r.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ healthStatus }),
    })))
    toast.success(`Updated ${rows.length} account(s)`)
    load()
  }

  // AUDIT S4-acct: CSV import via the new /api/accounts/import endpoint (dedup by name).
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data
          .map((r) => ({
            name: (r.name ?? r.Name ?? r.account ?? r.Account ?? '').trim(),
            csmName: (r.csmName ?? r.CSM ?? r.csm ?? '').trim(),
            csmEmail: (r.csmEmail ?? r.email ?? r.Email ?? '').trim(),
          }))
          .filter((r) => r.name)
        if (rows.length === 0) { toast.error('No account rows found (need a "name" column)'); return }
        try {
          const res = await fetch('/api/accounts/import', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: rows }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error()
          toast.success(`Imported ${data.created}${data.skipped ? `, skipped ${data.skipped} dupes` : ''}`)
          load()
        } catch { toast.error('Import failed') }
      },
    })
  }

  const columns: ColumnDef<Account>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
        </div>
      ),
      enableSorting: false,
    },
    { accessorKey: 'name', header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />, cell: ({ row }) => <span className="font-medium">{row.getValue('name')}</span> },
    { accessorKey: 'healthStatus', header: ({ column }) => <DataTableColumnHeader column={column} title="Health" />, cell: ({ row }) => { const h = healthConfig[row.getValue('healthStatus') as string]; return h ? <Badge variant={h.variant}>{h.label}</Badge> : null } },
    { accessorKey: 'csmName', header: 'CSM', cell: ({ row }) => <span className="text-sm">{(row.getValue('csmName') as string) || '—'}</span> },
    { accessorKey: 'meetingCadence', header: 'Cadence', cell: ({ row }) => <span className="text-sm text-muted-foreground">{(row.getValue('meetingCadence') as string).toLowerCase()}</span> },
    { id: 'updates', header: 'Updates', cell: ({ row }) => <Badge variant="secondary">{row.original._count.updates}</Badge> },
    // AUDIT S4-acct: last-updated column so CSMs can spot stale accounts.
    { accessorKey: 'updatedAt', header: ({ column }) => <DataTableColumnHeader column={column} title="Last Updated" />, cell: ({ row }) => <span className="text-sm text-muted-foreground">{new Date(row.getValue('updatedAt') as string).toLocaleDateString()}</span> },
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
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onImportFile} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Import CSV</Button>
          <Button onClick={() => { reset(); setOpen(true) }}><Plus className="h-4 w-4 mr-1" />Add Account</Button>
        </div>
      </div>

      <DataTable
        columns={columns} data={accounts} searchKey="name" searchPlaceholder="Search accounts..."
        onRowClick={(row) => router.push(`/accounts/${row.id}`)}
        bulkActions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: bulkDelete },
          { label: 'Mark At-Risk', onClick: (rows) => bulkSetHealth(rows, 'AT_RISK') },
          { label: 'Mark Churned', onClick: (rows) => bulkSetHealth(rows, 'CHURNED') },
        ]}
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
