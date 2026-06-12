'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Plus, ExternalLink, GripVertical, Pencil, Trash2, Eye, EyeOff,
  Figma, FileText, Settings, BookOpen, Video, Image, MessageSquare,
  CheckSquare, HelpCircle, Ticket, Swords, GitBranch, Link, StickyNote,
  ChevronUp, ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
export type BlockType =
  | 'FIGMA' | 'DOCS' | 'CONFIG' | 'RELEASE_NOTES' | 'PRD'
  | 'VIDEO' | 'SCREENSHOTS' | 'DESIGN_FILES' | 'CONVERSATION'
  | 'NOTES' | 'CHECKLIST' | 'FAQ' | 'TICKET'
  | 'COMPETITOR_REF' | 'ROADMAP_REF' | 'EXTERNAL'

export interface ContentBlock {
  id: string
  type: BlockType
  label: string
  url?: string
  content?: string
  items?: string[]     // for CHECKLIST
  isVisible: boolean
  order: number
}

const BLOCK_DEFS: Record<BlockType, { label: string; icon: any; isLink: boolean; placeholder: string }> = {
  FIGMA:          { label: 'Figma',           icon: Figma,         isLink: true,  placeholder: 'https://figma.com/...' },
  DOCS:           { label: 'Docs',            icon: BookOpen,      isLink: true,  placeholder: 'https://docs.yourapp.com/...' },
  CONFIG:         { label: 'Configuration',   icon: Settings,      isLink: false, placeholder: 'Configuration steps, toggles, settings...' },
  RELEASE_NOTES:  { label: 'Release Notes',   icon: GitBranch,     isLink: true,  placeholder: 'https://changelog.yourapp.com/...' },
  PRD:            { label: 'PRD / Spec',       icon: FileText,      isLink: true,  placeholder: 'https://notion.so/...' },
  VIDEO:          { label: 'Video / Demo',    icon: Video,         isLink: true,  placeholder: 'https://youtube.com/...' },
  SCREENSHOTS:    { label: 'Screenshots',     icon: Image,         isLink: false, placeholder: 'Describe or paste image URLs, one per line' },
  DESIGN_FILES:   { label: 'Design Files',    icon: Image,         isLink: true,  placeholder: 'https://zeplin.io/...' },
  CONVERSATION:   { label: 'Conversation',    icon: MessageSquare, isLink: false, placeholder: 'Paste a conversation, Slack thread, or decision history...' },
  NOTES:          { label: 'Notes',           icon: StickyNote,    isLink: false, placeholder: 'Free-form notes, context, internal explanations...' },
  CHECKLIST:      { label: 'Checklist',       icon: CheckSquare,   isLink: false, placeholder: 'Step 1\nStep 2\nStep 3' },
  FAQ:            { label: 'FAQ Block',       icon: HelpCircle,    isLink: false, placeholder: 'Q: What does this do?\nA: It does...' },
  TICKET:         { label: 'Ticket / Story',  icon: Ticket,        isLink: true,  placeholder: 'https://jira.yourco.com/browse/...' },
  COMPETITOR_REF: { label: 'Competitor Ref',  icon: Swords,        isLink: true,  placeholder: 'https://competitor.com/...' },
  ROADMAP_REF:    { label: 'Roadmap Ref',     icon: GitBranch,     isLink: true,  placeholder: 'https://your-roadmap.com/...' },
  EXTERNAL:       { label: 'External Link',   icon: Link,          isLink: true,  placeholder: 'https://...' },
}

const TYPE_GROUPS: { group: string; types: BlockType[] }[] = [
  { group: 'Design & Docs', types: ['FIGMA', 'DOCS', 'PRD', 'DESIGN_FILES', 'SCREENSHOTS'] },
  { group: 'Dev & Release', types: ['TICKET', 'RELEASE_NOTES', 'ROADMAP_REF'] },
  { group: 'Media', types: ['VIDEO'] },
  { group: 'Configuration', types: ['CONFIG', 'CHECKLIST'] },
  { group: 'Knowledge', types: ['NOTES', 'FAQ', 'CONVERSATION'] },
  { group: 'Competitive', types: ['COMPETITOR_REF'] },
  { group: 'Other', types: ['EXTERNAL'] },
]

// ─── Block Row ────────────────────────────────────────────────────────────────
function BlockRow({
  block, onEdit, onDelete, onToggleVisible, onMove, isFirst, isLast,
}: {
  block: ContentBlock
  onEdit: () => void
  onDelete: () => void
  onToggleVisible: () => void
  onMove: (dir: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
}) {
  const def = BLOCK_DEFS[block.type]
  const Icon = def.icon

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${block.isVisible ? 'bg-card' : 'bg-muted/40 opacity-60'}`}>
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-muted`}>
        <Icon className="h-3.5 w-3.5 text-foreground/70" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{block.label || def.label}</p>
        {block.url && (
          <a href={block.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary/70 hover:text-primary truncate flex items-center gap-0.5 max-w-xs"
            onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            {block.url.replace(/^https?:\/\//, '').slice(0, 50)}
          </a>
        )}
        {block.content && !block.url && (
          <p className="text-xs text-muted-foreground truncate max-w-xs">{block.content.slice(0, 80)}</p>
        )}
      </div>
      <Badge variant="outline" className="text-[10px] hidden sm:flex">{def.label}</Badge>
      <div className="flex items-center gap-0.5 shrink-0">
        <button className="p-1 rounded hover:bg-muted disabled:opacity-30" onClick={() => onMove('up')} disabled={isFirst}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button className="p-1 rounded hover:bg-muted disabled:opacity-30" onClick={() => onMove('down')} disabled={isLast}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button className="p-1 rounded hover:bg-muted" onClick={onToggleVisible} title={block.isVisible ? 'Hide' : 'Show'}>
          {block.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        <button className="p-1 rounded hover:bg-muted" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></button>
        <button className="p-1 rounded hover:bg-muted text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

// ─── Block Viewer (read mode) ─────────────────────────────────────────────────
export function BlockViewer({ block }: { block: ContentBlock }) {
  const def = BLOCK_DEFS[block.type]
  const Icon = def.icon
  const [checkItems, setCheckItems] = useState<{ text: string; done: boolean }[]>(() => {
    if (block.type !== 'CHECKLIST') return []
    const raw = block.items ?? (block.content ? block.content.split('\n') : [])
    return raw.map((t) => ({ text: t, done: false }))
  })

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{block.label || def.label}</span>
        {block.url && (
          <a href={block.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
      </div>
      <div className="px-3 py-2.5">
        {block.type === 'CHECKLIST' ? (
          <ul className="space-y-1.5">
            {checkItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => setCheckItems((prev) => prev.map((ci, j) => j === i ? { ...ci, done: !ci.done } : ci))}
                  className="mt-0.5 rounded"
                />
                <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
              </li>
            ))}
          </ul>
        ) : block.url && !block.content ? (
          <a href={block.url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            {block.url}
          </a>
        ) : block.content ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{block.content}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">No content</p>
        )}
      </div>
    </div>
  )
}

// ─── Add / Edit Block Dialog ──────────────────────────────────────────────────
function BlockDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean
  initial: ContentBlock | null
  onClose: () => void
  onSave: (b: ContentBlock) => void
}) {
  const [type, setType] = useState<BlockType>(initial?.type ?? 'DOCS')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [content, setContent] = useState(initial?.content ?? '')

  const def = BLOCK_DEFS[type]

  const handleSave = () => {
    const block: ContentBlock = {
      id: initial?.id ?? Math.random().toString(36).slice(2, 10),
      type,
      label: label.trim() || def.label,
      url: url.trim() || undefined,
      content: content.trim() || undefined,
      items: type === 'CHECKLIST' ? content.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      isVisible: initial?.isVisible ?? true,
      order: initial?.order ?? 0,
    }
    onSave(block)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Block' : 'Add Content Block'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Block Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as BlockType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{g.group}</div>
                    {g.types.map((t) => {
                      const d = BLOCK_DEFS[t]
                      const I = d.icon
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2"><I className="h-3.5 w-3.5" />{d.label}</span>
                        </SelectItem>
                      )
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Custom Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={def.label} />
          </div>
          {def.isLink && (
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={def.placeholder} />
            </div>
          )}
          {(!def.isLink || ['CONFIG', 'NOTES', 'CONVERSATION', 'FAQ', 'CHECKLIST', 'SCREENSHOTS'].includes(type)) && (
            <div className="space-y-1.5">
              <Label>
                {type === 'CHECKLIST' ? 'Items (one per line)' : 'Content'}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={def.placeholder}
                rows={type === 'CHECKLIST' ? 6 : 4}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            {initial ? 'Save Changes' : 'Add Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
interface Props {
  featureId: string
  initialBlocks: ContentBlock[]
  readOnly?: boolean
}

export function ContentBlocksPanel({ featureId, initialBlocks, readOnly = false }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    [...initialBlocks].sort((a, b) => a.order - b.order)
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ContentBlock | null>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>(readOnly ? 'view' : 'view')

  const persist = async (next: ContentBlock[]) => {
    setSaving(true)
    try {
      await fetch(`/api/features/${featureId}/content-blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const update = (next: ContentBlock[]) => {
    const reordered = next.map((b, i) => ({ ...b, order: i }))
    setBlocks(reordered)
    persist(reordered)
  }

  const addBlock = (b: ContentBlock) => update([...blocks, { ...b, order: blocks.length }])
  const editBlock = (b: ContentBlock) => update(blocks.map((x) => x.id === b.id ? b : x))
  const deleteBlock = (id: string) => update(blocks.filter((b) => b.id !== id))
  const toggleVisible = (id: string) => update(blocks.map((b) => b.id === id ? { ...b, isVisible: !b.isVisible } : b))
  const move = (id: string, dir: 'up' | 'down') => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const next = [...blocks]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]]
    update(next)
  }

  const visibleBlocks = blocks.filter((b) => b.isVisible)
  const hiddenCount = blocks.filter((b) => !b.isVisible).length

  if (readOnly || mode === 'view') {
    return (
      <div className="space-y-3">
        {visibleBlocks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Link className="h-7 w-7 opacity-30" />
            <p className="text-sm">No content blocks yet</p>
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Block
              </Button>
            )}
          </div>
        )}
        {visibleBlocks.map((b) => <BlockViewer key={b.id} block={b} />)}
        {!readOnly && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Block
            </Button>
            {blocks.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Manage Blocks
                {hiddenCount > 0 && <span className="ml-1 text-muted-foreground">({hiddenCount} hidden)</span>}
              </Button>
            )}
          </div>
        )}
        <BlockDialog open={dialogOpen} initial={editTarget} onClose={() => setDialogOpen(false)} onSave={editTarget ? editBlock : addBlock} />
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? 's' : ''} · drag to reorder</p>
        <div className="flex gap-2">
          {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Done</Button>
          <Button size="sm" variant="outline" onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
            onEdit={() => { setEditTarget(b); setDialogOpen(true) }}
            onDelete={() => deleteBlock(b.id)}
            onToggleVisible={() => toggleVisible(b.id)}
            onMove={(dir) => move(b.id, dir)}
          />
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No blocks yet</p>
        )}
      </div>
      <BlockDialog
        open={dialogOpen}
        initial={editTarget}
        onClose={() => setDialogOpen(false)}
        onSave={editTarget ? editBlock : addBlock}
      />
    </div>
  )
}
