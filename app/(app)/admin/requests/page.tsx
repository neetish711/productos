'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
  AlertCircle,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/permissions'

interface AccessRequest {
  id: string
  name: string
  email: string
  requestedRole: string
  reason: string | null
  createdAt: string
  status: string
}

interface Product {
  id: string
  name: string
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Approve dialog state
  const [approveDialog, setApproveDialog] = useState<AccessRequest | null>(null)
  const [approveRole, setApproveRole] = useState('')
  const [approveProductIds, setApproveProductIds] = useState<string[]>([])
  const [approving, setApproving] = useState(false)

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState<AccessRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Success / error feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/access-requests')
      if (!res.ok) throw new Error('Failed to fetch requests')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : data.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests')
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
    fetchRequests()
    fetchProducts()
  }, [fetchRequests, fetchProducts])

  const openApprove = (req: AccessRequest) => {
    setApproveDialog(req)
    setApproveRole(req.requestedRole || 'VIEWER')
    setApproveProductIds([])
    setFeedback(null)
  }

  const openReject = (req: AccessRequest) => {
    setRejectDialog(req)
    setRejectNote('')
    setFeedback(null)
  }

  const handleApprove = async () => {
    if (!approveDialog) return
    setApproving(true)
    try {
      const res = await fetch(`/api/access-requests/${approveDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE',
          role: approveRole,
          productIds: approveProductIds,
        }),
      })
      if (!res.ok) throw new Error('Failed to approve request')
      setFeedback({ type: 'success', message: `Approved ${approveDialog.name}'s request.` })
      setApproveDialog(null)
      fetchRequests()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Approval failed' })
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectDialog) return
    setRejecting(true)
    try {
      const res = await fetch(`/api/access-requests/${rejectDialog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT',
          reviewNote: rejectNote,
        }),
      })
      if (!res.ok) throw new Error('Failed to reject request')
      setFeedback({ type: 'success', message: `Rejected ${rejectDialog.name}'s request.` })
      setRejectDialog(null)
      fetchRequests()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Rejection failed' })
    } finally {
      setRejecting(false)
    }
  }

  const toggleProduct = (productId: string) => {
    setApproveProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
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

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No pending requests</p>
          <p className="text-sm">Access requests will appear here when submitted.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Requested Role</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.name}</TableCell>
                  <TableCell>{req.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ROLE_LABELS[req.requestedRole] ?? req.requestedRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {req.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => openApprove(req)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openReject(req)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => !open && setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Access Request</DialogTitle>
            <DialogDescription>
              Approve {approveDialog?.name}&apos;s request and assign a role and products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={approveRole} onValueChange={setApproveRole}>
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
            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Products</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`product-${product.id}`}
                        checked={approveProductIds.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      <Label htmlFor={`product-${product.id}`} className="font-normal cursor-pointer">
                        {product.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)} disabled={approving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Access Request</DialogTitle>
            <DialogDescription>
              Reject {rejectDialog?.name}&apos;s request. Optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Review Note (optional)</Label>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
