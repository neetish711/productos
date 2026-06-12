'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Plus,
  Pencil,
  Archive,
  Loader2,
  Package,
  AlertCircle,
  CheckCircle2,
  Map,
  Layers,
  Users,
} from 'lucide-react'

interface ProductItem {
  id: string
  name: string
  description: string | null
  roadmapItemsCount?: number
  featuresCount?: number
  usersCount?: number
  archived?: boolean
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create / Edit dialog
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Archive confirmation
  const [archiveProduct, setArchiveProduct] = useState<ProductItem | null>(null)
  const [archiving, setArchiving] = useState(false)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.products ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const openCreate = () => {
    setDialogMode('create')
    setEditProduct(null)
    setFormName('')
    setFormDescription('')
    setFeedback(null)
  }

  const openEdit = (product: ProductItem) => {
    setDialogMode('edit')
    setEditProduct(product)
    setFormName(product.name)
    setFormDescription(product.description ?? '')
    setFeedback(null)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const isEdit = dialogMode === 'edit' && editProduct
      const url = isEdit ? `/api/admin/products/${editProduct.id}` : '/api/admin/products'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() || null }),
      })
      if (!res.ok) throw new Error(`Failed to ${isEdit ? 'update' : 'create'} product`)
      setFeedback({ type: 'success', message: `Product ${isEdit ? 'updated' : 'created'} successfully.` })
      setDialogMode(null)
      setEditProduct(null)
      fetchProducts()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!archiveProduct) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/admin/products/${archiveProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) throw new Error('Failed to archive product')
      setFeedback({ type: 'success', message: `Archived ${archiveProduct.name}.` })
      setArchiveProduct(null)
      fetchProducts()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Archive failed' })
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? 's' : ''}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No products yet</p>
          <p className="text-sm">Create your first product to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className={product.archived ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    {product.archived && (
                      <Badge variant="secondary" className="text-xs">Archived</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(product)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!product.archived && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setArchiveProduct(product); setFeedback(null) }}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription className="line-clamp-2">
                  {product.description || 'No description provided.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Map className="h-3.5 w-3.5" />
                    <span>{product.roadmapItemsCount ?? 0} roadmap items</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    <span>{product.featuresCount ?? 0} features</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{product.usersCount ?? 0} users</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Product Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) { setDialogMode(null); setEditProduct(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? 'Edit Product' : 'Create Product'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit' ? 'Update the product details.' : 'Add a new product to your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Product name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-desc">Description</Label>
              <Textarea
                id="product-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of the product..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogMode(null); setEditProduct(null) }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogMode === 'edit' ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={!!archiveProduct} onOpenChange={(open) => !open && setArchiveProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {archiveProduct?.name}? Users will no longer be able to access it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveProduct(null)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
