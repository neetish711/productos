'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, CheckCircle, X, FileText, Lightbulb, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Suggestion = {
  id: string; title: string; description: string; category: string
  aiRationale: string | null; aiConfidence: number | null; sourceType: string; priorityScore: number
}

type Idea = {
  id: string; title: string; description: string; category: string
  aiRationale: string | null; sourceType: string; createdAt: string
  riceImpact: number
}

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Internal',
  ACCOUNT_FEEDBACK: 'Customer Feedback',
  COMPETITOR_GAP: 'Competitive',
  VOICE_INPUT: 'Voice Note',
}

const PRIORITY_FROM_IMPACT = (impact: number) => {
  if (impact >= 7) return { label: 'High', className: 'bg-red-100 text-red-700 border-red-200' }
  if (impact >= 4) return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
  return { label: 'Low', className: 'bg-green-100 text-green-700 border-green-200' }
}

type Tab = 'ai' | 'ideas'

export function AiSuggestionsClient({
  initialSuggestions,
  initialIdeas,
  products,
}: {
  initialSuggestions: Suggestion[]
  initialIdeas: Idea[]
  products: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [tab, setTab] = React.useState<Tab>('ai')
  const [suggestions, setSuggestions] = React.useState(initialSuggestions)
  const [ideas, setIdeas] = React.useState(initialIdeas)
  const [generating, setGenerating] = React.useState(false)

  async function loadSuggestions() {
    const res = await fetch('/api/roadmap?ai=true')
    if (res.ok) setSuggestions(await res.json())
  }

  async function loadIdeas() {
    const res = await fetch('/api/roadmap?ideas=true')
    if (res.ok) setIdeas(await res.json())
  }

  async function promote(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAiSuggested: false }),
    })
    if (res.ok) { toast.success('Added to Main Roadmap'); loadSuggestions() }
    else toast.error('Failed')
  }

  async function dismiss(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissedAt: new Date().toISOString() }),
    })
    if (res.ok) { toast.success('Dismissed'); loadSuggestions() }
    else toast.error('Failed')
  }

  async function convertIdea(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDraft: false }),
    })
    if (res.ok) { toast.success('Moved to roadmap'); loadIdeas(); router.push('/roadmap') }
    else toast.error('Failed to convert idea')
  }

  async function dismissIdea(id: string) {
    const res = await fetch(`/api/roadmap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissedAt: new Date().toISOString() }),
    })
    if (res.ok) { toast.success('Idea dismissed'); loadIdeas() }
    else toast.error('Failed')
  }

  async function generateSpec(item: Suggestion) {
    const res = await fetch('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roadmapItemId: item.id, title: item.title, contentMd: `# ${item.title}\n\n${item.description}`, generationMethod: 'AI_GENERATED' }),
    })
    if (res.ok) { const spec = await res.json(); router.push(`/specs/${spec.id}`) }
    else toast.error('Failed')
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            AI Suggestions &amp; Ideas
          </h1>
          <p className="text-muted-foreground text-sm">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} · {ideas.length} idea{ideas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {tab === 'ai' && (
          <Button
            variant="outline"
            onClick={() => toast.info('Run a competitor analysis workflow to generate suggestions')}
            disabled={generating}
          >
            <Sparkles className="h-4 w-4 mr-1" />Generate Suggestions
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'ai'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setTab('ai')}
        >
          <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
          AI Suggestions
          {suggestions.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs py-0 px-1.5 h-4">{suggestions.length}</Badge>
          )}
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'ideas'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setTab('ideas')}
        >
          <Lightbulb className="h-3.5 w-3.5 inline mr-1.5" />
          My Ideas
          {ideas.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs py-0 px-1.5 h-4">{ideas.length}</Badge>
          )}
        </button>
      </div>

      {/* AI Suggestions tab */}
      {tab === 'ai' && (
        suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Sparkles className="h-12 w-12 text-violet-300" />
            <p className="font-medium text-lg">No AI suggestions yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Run a competitor analysis or gap analysis workflow to generate AI-powered roadmap suggestions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((s) => (
              <Card key={s.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{s.title}</CardTitle>
                    {s.aiConfidence && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {Math.round(s.aiConfidence * 100)}% conf.
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {s.sourceType.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{s.category}</Badge>
                    {s.priorityScore > 0 && (
                      <Badge variant="outline" className="text-xs">RICE: {s.priorityScore}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  {s.aiRationale && (
                    <div className="bg-violet-50 border border-violet-100 rounded p-3">
                      <p className="text-xs font-medium text-violet-700 mb-1">AI Rationale</p>
                      <p className="text-xs text-violet-600">{s.aiRationale}</p>
                    </div>
                  )}
                </CardContent>
                <div className="px-6 pb-4 flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="flex-1" onClick={() => promote(s.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Add to Roadmap
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => generateSpec(s)}>
                    <FileText className="h-3.5 w-3.5 mr-1" />Spec
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => dismiss(s.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Ideas tab */}
      {tab === 'ideas' && (
        ideas.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Lightbulb className="h-12 w-12 text-yellow-300" />
            <p className="font-medium text-lg">No ideas yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Click <strong>New Idea</strong> in the top bar to capture a rough idea before it becomes a roadmap item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map((idea) => {
              const priority = PRIORITY_FROM_IMPACT(idea.riceImpact)
              return (
                <Card key={idea.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-snug">{idea.title}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium',
                          priority.className
                        )}
                      >
                        {priority.label}
                      </span>
                      <Badge variant="outline" className="text-xs">{idea.category}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {SOURCE_LABEL[idea.sourceType] ?? idea.sourceType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    {idea.description && (
                      <p className="text-sm text-muted-foreground">{idea.description}</p>
                    )}
                    {idea.aiRationale && (
                      <div className="rounded bg-muted/50 p-2.5">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Notes</p>
                        <p className="text-xs text-foreground">{idea.aiRationale}</p>
                      </div>
                    )}
                  </CardContent>
                  <div className="px-6 pb-4 flex items-center gap-2">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={() => convertIdea(idea.id)}>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Add to Roadmap
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => dismissIdea(idea.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
