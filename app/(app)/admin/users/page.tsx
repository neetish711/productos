'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Pencil,
  UserX,
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { ROLE_LABELS, ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_DEFAULTS } from '@/lib/permissions'

interface UserItem {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  permissions: string[]
  products: { id: string; name: string }[]
}

interface Product {
  id: string
  name: string
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  APPROVED: { variant: 'default', className: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  PENDING: { variant: 'secondary', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  DEACTIVATED: { variant: 'destructive', className: '' },
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Edit dialog
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editPermissions, setEditPermissions] = useState<string[]>([])
  const [editProductIds, setEditProductIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Deactivate dialog
  const [deactivateUser, setDeactivateUser] = useState<UserItem | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products')
      if (!res.ok) return
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.products ?? [])
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchProducts()
  }, [fetchUsers, fetchProducts])

  const openEdit = (user: UserItem) => {
    setEditUser(user)
    setEditRole(user.role)
    setEditPermissions(user.permissions ?? [])
    setEditProductIds(user.products?.map((p) => p.id) ?? [])
    setFeedback(null)
  }

  const handleRoleChange = (role: string) => {
    setEditRole(role)
    // Reset permissions to role defaults when role changes
    setEditPermissions(ROLE_DEFAULTS[role] ?? [])
  }

  const togglePermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const toggleEditProduct = (productId: string) => {
    setEditProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSaveUser = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          permissions: editPermissions,
          productIds: editProductIds,
        }),
      })
      if (!res.ok) throw new Error('Failed to update user')
      setFeedback({ type: 'success', message: `Updated ${editUser.name ?? editUser.email}.` })
      setEditUser(null)
      fetchUsers()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateUser) return
    setDeactivating(true)
    try {
      const res = await fetch(`/api/admin/users/${deactivateUser.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to deactivate user')
      setFeedback({ type: 'success', message: `Deactivated ${deactivateUser.name ?? deactivateUser.email}.` })
      setDeactivateUser(null)
      fetchUsers()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Deactivation failed' })
    } finally {
      setDeactivating(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'} className={feedback.type === 'success' ? 'border-green-500/50 text-green-700 dark:text-green-400' : ''}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm">{search ? 'Try a different search term.' : 'Users will appear here once they are approved.'}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const statusStyle = STATUS_BADGE[user.status] ?? STATUS_BADGE.PENDING
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name ?? '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusStyle.variant} className={statusStyle.className}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.products && user.products.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.products.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-xs">
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {user.status !== 'DEACTIVATED' && (
                        <Button size="sm" variant="destructive" onClick={() => { setDeactivateUser(user); setFeedback(null) }}>
                          <UserX className="h-4 w-4 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role, permissions, and product assignments for {editUser?.name ?? editUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
                {ALL_PERMISSIONS.map((perm) => {
                  const info = PERMISSION_LABELS[perm]
                  return (
                    <div key={perm} className="flex items-center gap-2">
                      <Checkbox
                        id={`perm-${perm}`}
                        checked={editPermissions.includes(perm)}
                        onCheckedChange={() => togglePermission(perm)}
                      />
                      <Label htmlFor={`perm-${perm}`} className="font-normal cursor-pointer text-sm">
                        {info?.label ?? perm}
                        <span className="text-muted-foreground ml-1 text-xs">({info?.module})</span>
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Products</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-product-${product.id}`}
                        checked={editProductIds.includes(product.id)}
                        onCheckedChange={() => toggleEditProduct(product.id)}
                      />
                      <Label htmlFor={`edit-product-${product.id}`} className="font-normal cursor-pointer">
                        {product.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={!!deactivateUser} onOpenChange={(open) => !open && setDeactivateUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {deactivateUser?.name ?? deactivateUser?.email}? They will lose access to the application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateUser(null)} disabled={deactivating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
