'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Plus, Upload, Search, Trash2, X, Package, SlidersHorizontal,
  ChevronDown, Star, Layers, LayoutGrid, List, CheckSquare,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

import { FeatureCard } from './feature-card'
import { FeatureDetailSheet } from './feature-detail-sheet'
import { JsonUploadDialog } from './json-upload-dialog'
import {
  Feature, Product, parseFeature, STATUS_CONFIG, FeatureStatus,
} from './types'
import {
  createOurFeature, updateOurFeature, deleteOurFeature, bulkDeleteOurFeatures,
} from '@/lib/db/queries/features'

// ─── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'updatedAt' | 'createdAt' | 'name' | 'status' | 'category'

interface Props {
  features: any[]   // raw from server — will be parsed
  products: Product[]
  orgId: string
}

// ─── Feature Form ─────────────────────────────────────────────────────────────
interface FormDialogProps {
  open: boolean
  onClose: () => void
  initial: Partial<Feature> | null
  products: Product[]
  orgId: string
  onDone: () => void
}

function FeatureFormDialog({ open, onClose, initial, products, orgId, onDone }: FormDialogProps) {
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'General')
  const [status, setStatus] = useState<FeatureStatus>(initial?.status ?? 'AVAILABLE')
  const [productId, setProductId] = useState(initial?.productId ?? products[0]?.id ?? '')
  const [build, setBuild] = useState(initial?.build ?? '')
  const [owner, setOwner] = useState(initial?.owner ?? '')
  const [platform, setPlatform] = useState(initial?.platform ?? '')
  const [maturityLevel, setMaturityLevel] = useState(initial?.maturityLevel ?? 'GA')
  const [isCustomerFacing, setIsCustomerFacing] = useState(initial?.isCustomerFacing ?? true)
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [valueProposition, setValueProposition] = useState(initial?.valueProposition ?? '')
  const [targetUsers, setTargetUsers] = useState(initial?.targetUsers ?? '')
  const [configDetails, setConfigDetails] = useState(initial?.configDetails ?? '')
  const [releaseNotes, setReleaseNotes] = useState(initial?.releaseNotes ?? '')
  const [introducedInBuild, setIntroducedInBuild] = useState(initial?.introducedInBuild ?? '')
  const [updatedInBuild, setUpdatedInBuild] = useState(initial?.updatedInBuild ?? '')

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const data = {
        name: name.trim(),
        description,
        category,
        status,
        tags: JSON.stringify(tagsArr),
        build: build || undefined,
        owner: owner || undefined,
        platform: platform || undefined,
        maturityLevel,
        isCustomerFacing,
        isFeatured,
        valueProposition,
        targetUsers,
        configDetails,
        releaseNotes,
        introducedInBuild: introducedInBuild || undefined,
        updatedInBuild: updatedInBuild || undefined,
      }
      if (isEdit && initial?.id) {
        await updateOurFeature(initial.id, orgId, data)
        toast.success('Feature updated')
      } else {
        await createOurFeature(orgId, { productId, ...data } as any)
        toast.success('Feature created')
      }
      onDone()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Core */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Core</p>
            {products.length > 1 && (
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId} disabled={isEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Feature Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI-Powered Search" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What this feature does" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. AI, Core, Integrations" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as FeatureStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground font-normal">(comma separated)</span></Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="search, ai, core" />
            </div>
          </div>

          <Separator />

          {/* Identity */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity & Ownership</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Build / Version</Label>
                <Input value={build} onChange={(e) => setBuild(e.target.value)} placeholder="v3.1" />
              </div>
              <div className="space-y-1.5">
                <Label>Owner / Team</Label>
                <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Platform Team" />
              </div>
              <div className="space-y-1.5">
                <Label>Platform / Module</Label>
                <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Web, Mobile, API" />
              </div>
              <div className="space-y-1.5">
                <Label>Maturity Level</Label>
                <Select value={maturityLevel} onValueChange={setMaturityLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GA', 'BETA', 'ALPHA', 'EXPERIMENTAL'].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="customerFacing" checked={isCustomerFacing} onCheckedChange={setIsCustomerFacing} />
                <Label htmlFor="customerFacing">Customer Facing</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
                <Label htmlFor="featured" className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Featured
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Value */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value & Users</p>
            <div className="space-y-1.5">
              <Label>Value Proposition</Label>
              <Textarea value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} rows={2} placeholder="Why this feature matters to customers" />
            </div>
            <div className="space-y-1.5">
              <Label>Target Users / Personas</Label>
              <Input value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} placeholder="PM, CSM, Admin" />
            </div>
          </div>

          <Separator />

          {/* Release & Config */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Release & Configuration</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Introduced in Build</Label>
                <Input value={introducedInBuild} onChange={(e) => setIntroducedInBuild(e.target.value)} placeholder="v2.0" />
              </div>
              <div className="space-y-1.5">
                <Label>Last Updated in Build</Label>
                <Input value={updatedInBuild} onChange={(e) => setUpdatedInBuild(e.target.value)} placeholder="v3.1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Configuration Notes</Label>
              <Textarea value={configDetails} onChange={(e) => setConfigDetails(e.target.value)} rows={2} placeholder="Steps, toggles, or admin settings" />
            </div>
            <div className="space-y-1.5">
              <Label>Release Notes</Label>
              <Textarea value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} rows={2} placeholder="What changed in this version" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Feature'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Hub ─────────────────────────────────────────────────────────────────
export function FeaturesClient({ features: rawFeatures, products, orgId }: Props) {
  const router = useRouter()

  // Parse all raw DB features to typed Features
  const allFeatures: Feature[] = useMemo(
    () => rawFeatures.map(parseFeature),
    [rawFeatures]
  )

  // ── Local state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FeatureStatus | 'ALL'>('ALL')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterMaturity, setFilterMaturity] = useState('ALL')
  const [filterFeatured, setFilterFeatured] = useState(false)
  const [filterCustomerFacing, setFilterCustomerFacing] = useState<'ALL' | 'CUSTOMER' | 'INTERNAL'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailFeature, setDetailFeature] = useState<Feature | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<Partial<Feature> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Feature | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allFeatures.map((f) => f.category))).sort()
    return cats
  }, [allFeatures])

  const filtered = useMemo(() => {
    let list = allFeatures

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q)) ||
          (f.owner ?? '').toLowerCase().includes(q) ||
          (f.build ?? '').toLowerCase().includes(q) ||
          (f.platform ?? '').toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'ALL') list = list.filter((f) => f.status === filterStatus)
    if (filterCategory !== 'ALL') list = list.filter((f) => f.category === filterCategory)
    if (filterMaturity !== 'ALL') list = list.filter((f) => f.maturityLevel === filterMaturity)
    if (filterFeatured) list = list.filter((f) => f.isFeatured)
    if (filterCustomerFacing === 'CUSTOMER') list = list.filter((f) => f.isCustomerFacing)
    if (filterCustomerFacing === 'INTERNAL') list = list.filter((f) => !f.isCustomerFacing)

    list = [...list].sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'updatedAt') { av = new Date(a.updatedAt).getTime(); bv = new Date(b.updatedAt).getTime() }
      else if (sortKey === 'createdAt') { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime() }
      else if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else if (sortKey === 'category') { av = a.category; bv = b.category }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [allFeatures, search, filterStatus, filterCategory, filterMaturity, filterFeatured, filterCustomerFacing, sortKey, sortDir])

  const hasFilters = filterStatus !== 'ALL' || filterCategory !== 'ALL' || filterMaturity !== 'ALL'
    || filterFeatured || filterCustomerFacing !== 'ALL' || !!search

  // ── Selection ────────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(filtered.map((f) => f.id)))
  const clearSelection = () => setSelected(new Set())

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openAdd = () => { setFormInitial(null); setFormOpen(true) }
  const openEdit = (f: Feature) => {
    setDetailFeature(null)
    setFormInitial(f)
    setFormOpen(true)
  }

  const handleDuplicate = async (f: Feature) => {
    try {
      const dupeData: any = {
        productId: f.productId,
        name: `${f.name} (copy)`,
        description: f.description,
        category: f.category,
        status: f.status,
        tags: JSON.stringify(f.tags),
        maturityLevel: f.maturityLevel,
        isCustomerFacing: f.isCustomerFacing,
        isFeatured: false,
        docsLinks: JSON.stringify(f.docsLinks),
        setupLinks: JSON.stringify(f.setupLinks),
        designFiles: JSON.stringify(f.designFiles),
        releaseNotes: f.releaseNotes,
        competitorMappings: JSON.stringify(f.competitorMappings),
        configDetails: f.configDetails,
        useCases: f.useCases,
        metadataJson: JSON.stringify(f.metadataJson),
        valueProposition: f.valueProposition,
        targetUsers: f.targetUsers,
        changelogJson: JSON.stringify(f.changelogJson),
      }
      if (f.build) dupeData.build = f.build
      if (f.owner) dupeData.owner = f.owner
      if (f.platform) dupeData.platform = f.platform
      if (f.introducedInBuild) dupeData.introducedInBuild = f.introducedInBuild
      if (f.updatedInBuild) dupeData.updatedInBuild = f.updatedInBuild
      await createOurFeature(orgId, dupeData)
      toast.success('Feature duplicated')
      router.refresh()
    } catch { toast.error('Failed to duplicate') }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOurFeature(deleteTarget.id, orgId)
      setDeleteTarget(null)
      toast.success('Feature deleted')
      router.refresh()
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    try {
      await bulkDeleteOurFeatures(Array.from(selected), orgId)
      clearSelection()
      setBulkDeleteOpen(false)
      toast.success(`${selected.size} feature${selected.size !== 1 ? 's' : ''} deleted`)
      router.refresh()
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  const clearFilters = () => {
    setSearch('')
    setFilterStatus('ALL')
    setFilterCategory('ALL')
    setFilterMaturity('ALL')
    setFilterFeatured(false)
    setFilterCustomerFacing('ALL')
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (allFeatures.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Feature Intelligence Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              The canonical repository of all product capabilities
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload JSON
            </Button>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Feature</Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h2 className="text-lg font-semibold">No features yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Upload a JSON file to bulk import features, or add them one by one.
          </p>
          <div className="flex gap-3 mt-5">
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload JSON
            </Button>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Feature</Button>
          </div>
        </div>
        <JsonUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => router.refresh()} products={products} />
        <FeatureFormDialog open={formOpen} onClose={() => setFormOpen(false)} initial={formInitial} products={products} orgId={orgId} onDone={() => router.refresh()} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 space-y-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Feature Intelligence Hub</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allFeatures.length} feature{allFeatures.length !== 1 ? 's' : ''} · canonical product capability registry
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Upload JSON
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Feature
            </Button>
          </div>
        </div>

        {/* Search + filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search features, tags, owner, build…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            {(['ALL', 'AVAILABLE', 'PLANNED', 'IN_REVIEW', 'DEPRECATED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterStatus === s
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Advanced filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-8 gap-1 ${hasFilters ? 'border-primary text-primary' : ''}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {hasFilters && <Badge className="ml-0.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center">!</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filterCategory === 'ALL'} onCheckedChange={() => setFilterCategory('ALL')}>
                All categories
              </DropdownMenuCheckboxItem>
              {categories.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={filterCategory === c}
                  onCheckedChange={() => setFilterCategory(c)}
                >
                  {c}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Maturity</DropdownMenuLabel>
              {['ALL', 'GA', 'BETA', 'ALPHA', 'EXPERIMENTAL'].map((m) => (
                <DropdownMenuCheckboxItem
                  key={m}
                  checked={filterMaturity === m}
                  onCheckedChange={() => setFilterMaturity(m)}
                >
                  {m === 'ALL' ? 'All maturity' : m}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Audience</DropdownMenuLabel>
              {(['ALL', 'CUSTOMER', 'INTERNAL'] as const).map((a) => (
                <DropdownMenuCheckboxItem
                  key={a}
                  checked={filterCustomerFacing === a}
                  onCheckedChange={() => setFilterCustomerFacing(a)}
                >
                  {a === 'ALL' ? 'All' : a === 'CUSTOMER' ? 'Customer facing' : 'Internal only'}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={filterFeatured} onCheckedChange={setFilterFeatured}>
                <Star className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Featured only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                Sort <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {(
                [
                  ['updatedAt', 'Recently Updated'],
                  ['createdAt', 'Recently Added'],
                  ['name', 'Name A–Z'],
                  ['status', 'Status'],
                  ['category', 'Category'],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={sortKey === key}
                  onCheckedChange={() => { setSortKey(key); setSortDir(key === sortKey && sortDir === 'asc' ? 'desc' : 'asc') }}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="px-6 py-2.5 bg-primary/5 border-b flex items-center gap-3">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="ghost" className="h-7" onClick={selectAll}>
            Select all {filtered.length}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="destructive" className="h-7" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete {selected.size}
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={clearSelection}>
              <X className="h-3.5 w-3.5 mr-1" /> Deselect
            </Button>
          </div>
        </div>
      )}

      {/* ── Card grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground opacity-30 mb-3" />
            <p className="font-medium">No features match your filters</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting the search or filters</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>Clear filters</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                {filtered.length} feature{filtered.length !== 1 ? 's' : ''}
                {search && ` matching "${search}"`}
                {!selected.size && (
                  <button className="ml-2 hover:underline" onClick={selectAll}>Select all</button>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  selected={selected.has(feature.id)}
                  onSelect={toggleSelect}
                  onClick={setDetailFeature}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Dialogs & sheets ────────────────────────────────────────────────── */}
      <FeatureDetailSheet
        feature={detailFeature}
        open={!!detailFeature}
        onClose={() => setDetailFeature(null)}
        onEdit={openEdit}
      />

      <FeatureFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={formInitial}
        products={products}
        orgId={orgId}
        onDone={() => router.refresh()}
      />

      <JsonUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => router.refresh()}
        products={products}
      />

      {/* Single delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Feature</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(v) => !v && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {selected.size} Features</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{selected.size} feature{selected.size !== 1 ? 's' : ''}</strong>.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : `Delete ${selected.size} Features`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
