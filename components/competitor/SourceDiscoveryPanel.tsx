'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle, Globe } from 'lucide-react'

interface SourceSuggestion {
  url: string
  sourceType: string
  label: string
  priority: string
  rationale: string
}

interface SourceDiscoveryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  competitorId: string
  onAccepted: (sources: Record<string, unknown>[]) => void
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  WEBSITE: 'bg-blue-100 text-blue-700',
  PRICING: 'bg-green-100 text-green-700',
  DOCS: 'bg-purple-100 text-purple-700',
  BLOG: 'bg-amber-100 text-amber-700',
  RELEASE_NOTES: 'bg-orange-100 text-orange-700',
  INTEGRATIONS: 'bg-cyan-100 text-cyan-700',
  TRUST: 'bg-slate-100 text-slate-700',
  GITHUB: 'bg-gray-100 text-gray-700',
  NEWS: 'bg-rose-100 text-rose-700',
  REDDIT: 'bg-red-100 text-red-700',
  YOUTUBE: 'bg-red-100 text-red-700',
}

export function SourceDiscoveryPanel({ open, onOpenChange, competitorId, onAccepted }: SourceDiscoveryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SourceSuggestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [accepting, setAccepting] = useState(false)
  const [message, setMessage] = useState('')

  async function discover() {
    setLoading(true)
    setSuggestions([])
    setSelected(new Set())
    setMessage('')
    try {
      const res = await fetch(`/api/competitors/${competitorId}/managed-sources/discover`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Discovery failed'); return }
      if (data.message) setMessage(data.message)
      setSuggestions(data.suggestions ?? [])
      // Select all by default
      setSelected(new Set((data.suggestions ?? []).map((_: unknown, i: number) => i)))
    } catch {
      toast.error('Discovery request failed')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function acceptSelected() {
    const toAdd = suggestions.filter((_, i) => selected.has(i))
    if (toAdd.length === 0) { toast.error('Select at least one source'); return }
    setAccepting(true)
    const added: Record<string, unknown>[] = []
    for (const s of toAdd) {
      try {
        const res = await fetch(`/api/competitors/${competitorId}/managed-sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: s.url,
            sourceType: s.sourceType,
            label: s.label,
            priority: s.priority,
            isAutoDiscovered: true,
          }),
        })
        if (res.ok) added.push(await res.json())
        else if (res.status !== 409) {
          const e = await res.json()
          console.warn('Skip source:', e.error)
        }
      } catch { /* skip */ }
    }
    toast.success(`Added ${added.length} source${added.length === 1 ? '' : 's'}`)
    onAccepted(added)
    onOpenChange(false)
    setAccepting(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>Discover Sources</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically discover the most valuable sources to monitor for this competitor based on their website and product type.
          </p>
          <Button onClick={discover} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Discovering…</> : 'Discover Sources'}
          </Button>

          {message && (
            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">{message}</p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{suggestions.length} suggestions found</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set(suggestions.map((_, i) => i)))}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selected.has(i) ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {selected.has(i)
                          ? <CheckCircle2 className="h-4 w-4 text-primary" />
                          : <XCircle className="h-4 w-4 text-muted-foreground/40" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{s.label}</span>
                          <Badge variant="secondary" className={`text-xs ${SOURCE_TYPE_COLORS[s.sourceType] ?? ''}`}>
                            {s.sourceType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {s.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">{s.url}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{s.rationale}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button onClick={acceptSelected} disabled={accepting || selected.size === 0} className="flex-1">
                  {accepting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : `Add ${selected.size} Selected`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
