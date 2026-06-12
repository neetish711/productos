'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, BookOpen, Tag } from 'lucide-react'

const CATEGORIES = [
  'spec-generation', 'lovable-generation', 'gap-analysis', 'battle-card', 'competitor-enrichment',
  'roadmap-suggestion', 'account-analysis', 'comparison', 'custom',
]

// Categories that serve as system prompts / master instruction blocks
const SYSTEM_PROMPT_CATEGORIES = new Set(['lovable-generation'])

interface Prompt {
  id: string
  category: string
  name: string
  description: string
  templateText: string
  variablesJson: string[] | string
  isActive: boolean
  version: number
}

function parseVars(v: string[] | string): string[] {
  if (Array.isArray(v)) return v
  try { return JSON.parse(v) } catch { return [] }
}

interface Props {
  prompts: Prompt[]
  orgId: string
}

export function PromptsClient({ prompts: initial, orgId }: Props) {
  const router = useRouter()
  const [prompts, setPrompts] = useState(initial)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category: 'custom',
    name: '',
    description: '',
    templateText: '',
    variablesInput: '',
    isActive: true,
  })

  const resetForm = () => setForm({ category: 'custom', name: '', description: '', templateText: '', variablesInput: '', isActive: true })

  const categories = Array.from(new Set(prompts.map(p => p.category)))
  const filtered = selectedCategory === 'all'
    ? prompts
    : prompts.filter(p => p.category === selectedCategory)

  const openEdit = (p: Prompt) => {
    setEditPrompt(p)
    setForm({
      category: p.category,
      name: p.name,
      description: p.description ?? '',
      templateText: p.templateText,
      variablesInput: parseVars(p.variablesJson).join(', '),
      isActive: p.isActive,
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const variables = form.variablesInput.split(',').map(v => v.trim()).filter(Boolean)
    const payload = {
      category: form.category,
      name: form.name,
      description: form.description,
      templateText: form.templateText,
      variablesJson: variables,
      isActive: form.isActive,
    }
    try {
      const url = editPrompt ? `/api/prompts/${editPrompt.id}` : '/api/prompts'
      const method = editPrompt ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const saved = await res.json()
      if (editPrompt) {
        setPrompts(prev => prev.map(p => p.id === saved.id ? saved : p))
        setEditPrompt(null)
      } else {
        setPrompts(prev => [...prev, saved])
        setShowCreate(false)
      }
      resetForm()
      toast.success(editPrompt ? 'Prompt updated' : 'Prompt created')
      router.refresh()
    } catch {
      toast.error('Failed to save prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prompt?')) return
    const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPrompts(prev => prev.filter(p => p.id !== id))
      toast.success('Deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const FormContent = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Prompt name" />
        </div>
      </div>
      <div>
        <Label>Description <span className="text-muted-foreground font-normal text-xs">(shown in Create Spec modal)</span></Label>
        <Input
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Short description of what this template generates"
        />
      </div>
      <div>
        <Label>Template</Label>
        <p className="text-xs text-muted-foreground mb-1">Use {'{{variable}}'} syntax for dynamic values</p>
        <Textarea
          value={form.templateText}
          onChange={e => setForm(p => ({ ...p, templateText: e.target.value }))}
          rows={10}
          className="font-mono text-sm"
          placeholder="You are a product manager assistant. Given the following feature: {{featureName}}..."
        />
      </div>
      <div>
        <Label>Variables (comma-separated)</Label>
        <Input
          value={form.variablesInput}
          onChange={e => setForm(p => ({ ...p, variablesInput: e.target.value }))}
          placeholder="featureName, competitorName, context"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
        <Label>Active</Label>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Category sidebar */}
      <div className="w-56 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">Categories</h2>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          <button
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === 'all' ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}
            onClick={() => setSelectedCategory('all')}
          >
            All prompts
            <Badge variant="secondary" className="ml-2 text-xs">{prompts.length}</Badge>
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedCategory === cat ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              <Badge variant="secondary" className="ml-2 text-xs">
                {prompts.filter(p => p.category === cat).length}
              </Badge>
            </button>
          ))}
        </div>
        <div className="p-3 border-t">
          <Button size="sm" className="w-full" onClick={() => { resetForm(); setShowCreate(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Prompt
          </Button>
        </div>
      </div>

      {/* Prompt list */}
      <div className="flex-1 overflow-auto p-6 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Prompt Templates</h1>
          <Badge variant="secondary">{filtered.length} prompts</Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="font-semibold">No prompts in this category</h3>
            <Button className="mt-4" onClick={() => { resetForm(); setShowCreate(true) }}>
              Create Prompt
            </Button>
          </div>
        ) : (
          filtered.map(prompt => (
            <div key={prompt.id} className="p-4 rounded-lg border space-y-3 hover:bg-accent/20 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{prompt.name}</span>
                    <Badge variant="secondary" className="text-xs">{prompt.category}</Badge>
                    {SYSTEM_PROMPT_CATEGORIES.has(prompt.category) && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">System Prompt</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">v{prompt.version}</Badge>
                    {!prompt.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  {prompt.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{prompt.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono opacity-70">
                    {prompt.templateText.slice(0, 120)}{prompt.templateText.length > 120 ? '…' : ''}
                  </p>
                  {parseVars(prompt.variablesJson).length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {parseVars(prompt.variablesJson).map(v => (
                        <span key={v} className="flex items-center gap-0.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                          <Tag className="h-3 w-3" />{v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(prompt)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(prompt.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Prompt</DialogTitle></DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPrompt} onOpenChange={v => !v && setEditPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Prompt</DialogTitle></DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPrompt(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
