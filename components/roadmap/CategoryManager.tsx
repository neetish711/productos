'use client'

import React from 'react'
import { toast } from 'sonner'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Color palette — exported so _client.tsx can consume it
// ---------------------------------------------------------------------------

export const CATEGORY_COLOR_PALETTE = [
  { value: 'violet', hex: '#8b5cf6', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
  { value: 'blue',   hex: '#3b82f6', dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
  { value: 'emerald',hex: '#10b981', dot: 'bg-emerald-500',badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  { value: 'orange', hex: '#f97316', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
  { value: 'rose',   hex: '#f43f5e', dot: 'bg-rose-500',   badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' },
  { value: 'pink',   hex: '#ec4899', dot: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800' },
  { value: 'teal',   hex: '#14b8a6', dot: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' },
  { value: 'amber',  hex: '#f59e0b', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  { value: 'slate',  hex: '#64748b', dot: 'bg-slate-500',  badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
]

export function getCategoryBadgeClasses(color: string | undefined): string {
  return CATEGORY_COLOR_PALETTE.find(c => c.value === color)?.badge
    ?? 'bg-secondary text-secondary-foreground border-transparent'
}

export function autoAssignColor(name: string, allNames: string[]): string {
  const idx = Math.max(0, allNames.indexOf(name))
  return CATEGORY_COLOR_PALETTE[idx % (CATEGORY_COLOR_PALETTE.length - 1)].value
}

// ---------------------------------------------------------------------------
// ColorPickerPopover — single dot that opens a color picker
// ---------------------------------------------------------------------------

function getDotStyle(color: string): React.CSSProperties {
  // If it looks like a hex color, use inline style
  if (color.startsWith('#')) return { backgroundColor: color }
  return {}
}

function getDotClass(color: string): string {
  const preset = CATEGORY_COLOR_PALETTE.find(c => c.value === color)
  return preset ? preset.dot : ''
}

interface ColorPickerPopoverProps {
  color: string
  onColorChange: (color: string) => void
}

function ColorPickerPopover({ color, onColorChange }: ColorPickerPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [hexInput, setHexInput] = React.useState('')

  const handlePresetClick = (value: string) => {
    onColorChange(value)
    setOpen(false)
  }

  const handleHexCommit = () => {
    const val = hexInput.trim()
    if (!val) return
    const normalized = val.startsWith('#') ? val : `#${val}`
    // Basic hex validation
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onColorChange(normalized)
      setHexInput('')
      setOpen(false)
    } else {
      toast.error('Enter a valid hex color (e.g. #a855f7)')
    }
  }

  const dotClass = getDotClass(color)
  const dotStyle = dotClass ? undefined : getDotStyle(color)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-4 w-4 rounded-full shrink-0 ring-offset-background transition-shadow',
            'hover:ring-2 hover:ring-offset-1 hover:ring-foreground/40',
            dotClass
          )}
          style={dotStyle}
          title="Change color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" align="start" side="right">
        <p className="text-xs font-medium text-muted-foreground mb-2">Preset colors</p>
        <div className="grid grid-cols-9 gap-1 mb-3">
          {CATEGORY_COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => handlePresetClick(c.value)}
              className={cn(
                'h-5 w-5 rounded-full transition-transform hover:scale-110',
                c.dot,
                color === c.value && 'ring-2 ring-offset-1 ring-foreground/60'
              )}
              title={c.value}
            />
          ))}
        </div>
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Custom hex</p>
          <div className="flex gap-1.5">
            <Input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleHexCommit()
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="#a855f7"
              className="h-7 text-xs flex-1 font-mono"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={handleHexCommit}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  categoryColors: Record<string, string>
  onUpdateColor: (category: string, color: string) => void
  onRename: (oldName: string, newName: string) => Promise<void>
  onDelete: (category: string) => Promise<void>
  onCreate: (name: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryManager({
  open,
  onOpenChange,
  categories,
  categoryColors,
  onUpdateColor,
  onRename,
  onDelete,
  onCreate,
}: CategoryManagerProps) {
  const [editingName, setEditingName] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState('')
  const [deletingName, setDeletingName] = React.useState<string | null>(null)
  const [newCatName, setNewCatName] = React.useState('')
  const [working, setWorking] = React.useState(false)

  const startEdit = (cat: string) => {
    setEditingName(cat)
    setEditValue(cat)
    setDeletingName(null)
  }

  const saveEdit = async () => {
    if (!editingName) return
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === editingName) { setEditingName(null); return }
    if (categories.includes(trimmed)) { toast.error('Category already exists'); return }
    setWorking(true)
    try {
      await onRename(editingName, trimmed)
      setEditingName(null)
    } finally {
      setWorking(false)
    }
  }

  const confirmDelete = async (cat: string) => {
    setWorking(true)
    try {
      await onDelete(cat)
      setDeletingName(null)
    } finally {
      setWorking(false)
    }
  }

  const handleCreate = () => {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) { toast.error('Category already exists'); return }
    onCreate(trimmed)
    setNewCatName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1 -mr-1">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No categories yet</p>
          )}

          {categories.map((cat) => {
            const color = categoryColors[cat] ?? autoAssignColor(cat, categories)
            const isEditing = editingName === cat
            const isDeleting = deletingName === cat

            return (
              <div key={cat} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group min-h-[36px]">
                {!isEditing && !isDeleting && (
                  <>
                    {/* Single color dot — click to open color picker */}
                    <ColorPickerPopover
                      color={color}
                      onColorChange={(c) => onUpdateColor(cat, c)}
                    />

                    {/* Badge preview */}
                    <span className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium flex-1 min-w-0',
                      getCategoryBadgeClasses(color)
                    )}>
                      <span className="truncate">{cat}</span>
                    </span>

                    {/* Row actions (hover) */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startEdit(cat)}
                        disabled={working}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeletingName(cat); setEditingName(null) }}
                        disabled={working}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}

                {isEditing && (
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingName(null)
                      }}
                      autoFocus
                      className="h-7 text-sm flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit} disabled={working}>
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {isDeleting && (
                  <div className="flex items-center gap-2 flex-1">
                    <p className="text-xs text-destructive flex-1">
                      Remove &ldquo;{cat}&rdquo;? Items keep their text.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs px-2"
                      onClick={() => confirmDelete(cat)}
                      disabled={working}
                    >
                      Remove
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => setDeletingName(null)}
                      disabled={working}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add new — always visible, outside the scroll area */}
        <div className="border-t pt-3 shrink-0">
          <p className="text-xs font-medium text-muted-foreground mb-2">Add category</p>
          <div className="flex gap-2">
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Category name…"
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" className="h-8 px-3" onClick={handleCreate} disabled={!newCatName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
