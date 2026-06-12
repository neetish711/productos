'use client'

import * as React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, X } from 'lucide-react'

const ALLOWED_CATEGORIES = ['AI Core', 'Automation', 'Governance', 'Channel', 'Admin', 'Deployment', 'Integrations']

interface Props {
  competitorId: string
  categoryTags: string[]
  onTagsChange?: (tags: string[]) => void
}

function storageKey(id: string) {
  return `competitor_custom_tags_${id}`
}

export function TagEditor({ competitorId, categoryTags, onTagsChange }: Props) {
  const filteredCategories = categoryTags.filter((c) => ALLOWED_CATEGORIES.includes(c))
  const [customTags, setCustomTags] = React.useState<string[]>([])
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [newTagInput, setNewTagInput] = React.useState('')

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey(competitorId))
      if (stored) setCustomTags(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [competitorId])

  function persistTags(tags: string[]) {
    setCustomTags(tags)
    localStorage.setItem(storageKey(competitorId), JSON.stringify(tags))
    onTagsChange?.(tags)
  }

  function addTag() {
    const val = newTagInput.trim()
    if (!val || customTags.includes(val)) return
    persistTags([...customTags, val])
    setNewTagInput('')
  }

  function removeTag(tag: string) {
    persistTags(customTags.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {filteredCategories.slice(0, 4).map((cat) => (
        <Badge key={cat} variant="secondary" className="text-xs font-normal">{cat}</Badge>
      ))}
      {filteredCategories.length > 4 && (
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">+{filteredCategories.length - 4}</Badge>
      )}
      {customTags.map((tag) => (
        <Badge key={tag} className="text-xs font-normal bg-violet-100 text-violet-700 border-violet-200 gap-1 pr-1">
          {tag}
        </Badge>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
            <Pencil className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          {filteredCategories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Feature categories</p>
              <div className="flex flex-wrap gap-1">
                {filteredCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs font-normal">{cat}</Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Custom tags</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {customTags.length === 0 && (
                <p className="text-xs text-muted-foreground">No custom tags yet</p>
              )}
              {customTags.map((tag) => (
                <Badge key={tag} className="text-xs font-normal bg-violet-100 text-violet-700 border-violet-200 gap-1 pr-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-violet-900 ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="New tag"
                className="h-7 text-xs flex-1"
              />
              <Button size="sm" className="h-7 text-xs px-2" onClick={addTag} disabled={!newTagInput.trim()}>
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
