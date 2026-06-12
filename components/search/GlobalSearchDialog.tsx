'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useUIStore } from '@/store/ui.store'
import { Search, FileText, Swords, Map, Users, Package, BookOpen } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

const TYPE_CONFIG = {
  feature: { icon: Package, label: 'Feature', href: '/features' },
  competitor: { icon: Swords, label: 'Competitor', href: '/competitors' },
  roadmap: { icon: Map, label: 'Roadmap', href: '/roadmap' },
  spec: { icon: FileText, label: 'Spec', href: '/specs' },
  account: { icon: Users, label: 'Account', href: '/accounts' },
  prompt: { icon: BookOpen, label: 'Prompt', href: '/prompts' },
}

interface SearchResult {
  type: string
  id: string
  title: string
  subtitle?: string
}

export function GlobalSearchDialog() {
  const router = useRouter()
  const { globalSearchOpen, setGlobalSearchOpen } = useUIStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setGlobalSearchOpen(true)
      }
      if (e.key === 'Escape') setGlobalSearchOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [setGlobalSearchOpen])

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return }
    const search = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        if (res.ok) setResults(await res.json())
      } catch {}
      finally { setLoading(false) }
    }
    search()
  }, [debouncedQuery])

  const navigate = (result: SearchResult) => {
    const config = TYPE_CONFIG[result.type as keyof typeof TYPE_CONFIG]
    if (!config) return
    if (['spec', 'competitor', 'account'].includes(result.type)) {
      router.push(`${config.href}/${result.id}`)
    } else {
      router.push(config.href)
    }
    setGlobalSearchOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <Dialog open={globalSearchOpen} onOpenChange={v => { setGlobalSearchOpen(v); if (!v) { setQuery(''); setResults([]) } }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search features, specs, competitors, accounts..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-96 overflow-auto">
          {loading && (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map(result => {
                const config = TYPE_CONFIG[result.type as keyof typeof TYPE_CONFIG]
                const Icon = config?.icon || Search
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                    onClick={() => navigate(result)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {config?.label || result.type}
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}

          {!query && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p>Start typing to search across all your data</p>
              <p className="mt-1 text-xs">Features · Specs · Competitors · Accounts · Roadmap</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
