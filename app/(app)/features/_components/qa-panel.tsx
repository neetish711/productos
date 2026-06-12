'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  MessageSquare, CheckCircle2, Plus, Trash2, Star, ChevronDown, ChevronUp,
  HelpCircle, Search,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Answer {
  id: string
  content: string
  answeredBy: string
  isBest: boolean
  isApproved: boolean
  createdAt: string
}

interface Question {
  id: string
  featureId: string
  question: string
  askedBy: string
  status: 'OPEN' | 'ANSWERED'
  answersJson: string
  createdAt: string
}

function parseAnswers(q: Question): Answer[] {
  try { return JSON.parse(q.answersJson) } catch { return [] }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Question Card ────────────────────────────────────────────────────────────
function QuestionCard({
  q, featureId, onUpdated, onDeleted,
}: {
  q: Question
  featureId: string
  onUpdated: (q: Question) => void
  onDeleted: (id: string) => void
}) {
  const answers = parseAnswers(q)
  const [expanded, setExpanded] = useState(answers.length > 0)
  const [answerText, setAnswerText] = useState('')
  const [answeredBy, setAnsweredBy] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submitAnswer = async () => {
    if (!answerText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/features/${featureId}/questions/${q.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: answerText.trim(), answeredBy: answeredBy.trim() }),
      })
      if (!res.ok) throw new Error()
      const newAnswer = await res.json()
      const updatedAnswers = [...answers, newAnswer]
      onUpdated({ ...q, answersJson: JSON.stringify(updatedAnswers), status: 'ANSWERED' })
      setAnswerText('')
      setAnsweredBy('')
      toast.success('Answer added')
    } catch { toast.error('Failed to add answer') }
    finally { setSubmitting(false) }
  }

  const markBest = async (answerId: string) => {
    try {
      await fetch(`/api/features/${featureId}/questions/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bestAnswerId: answerId }),
      })
      const updatedAnswers = answers.map((a) => ({ ...a, isBest: a.id === answerId }))
      onUpdated({ ...q, answersJson: JSON.stringify(updatedAnswers), status: 'ANSWERED' })
      toast.success('Best answer marked')
    } catch { toast.error('Failed') }
  }

  const deleteQuestion = async () => {
    try {
      await fetch(`/api/features/${featureId}/questions/${q.id}`, { method: 'DELETE' })
      onDeleted(q.id)
      toast.success('Question removed')
    } catch { toast.error('Failed to delete') }
  }

  const bestAnswer = answers.find((a) => a.isBest)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Question header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium leading-snug">{q.question}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{q.askedBy}</span>
            <span className="text-xs text-muted-foreground">· {timeAgo(q.createdAt)}</span>
            <Badge
              variant={q.status === 'ANSWERED' ? 'default' : 'secondary'}
              className={`text-[10px] h-4 ${q.status === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800 border-0' : ''}`}
            >
              {q.status === 'ANSWERED' ? '✓ Answered' : 'Open'}
            </Badge>
            {answers.length > 0 && (
              <span className="text-xs text-muted-foreground">{answers.length} answer{answers.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button className="p-1 rounded hover:bg-muted text-destructive/70 hover:text-destructive" onClick={deleteQuestion}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Best answer preview (collapsed) */}
      {!expanded && bestAnswer && (
        <div className="px-4 pb-3 ml-7">
          <div className="flex items-start gap-2 bg-emerald-50 rounded-md px-2.5 py-2 border border-emerald-100">
            <Star className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-emerald-900 line-clamp-2">{bestAnswer.content}</p>
          </div>
        </div>
      )}

      {/* Expanded: all answers + add answer */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {answers.length > 0 ? (
            <div className="space-y-2.5">
              {answers.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-md px-3 py-2.5 border text-sm ${a.isBest ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/40'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="leading-relaxed whitespace-pre-line">{a.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">{a.answeredBy} · {timeAgo(a.createdAt)}</span>
                        {a.isBest && (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-700 font-medium">
                            <Star className="h-3 w-3 fill-current" /> Best Answer
                          </span>
                        )}
                        {a.isApproved && !a.isBest && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-600">
                            <CheckCircle2 className="h-3 w-3" /> Approved
                          </span>
                        )}
                      </div>
                    </div>
                    {!a.isBest && (
                      <button
                        className="text-xs text-muted-foreground hover:text-emerald-700 flex items-center gap-0.5 shrink-0"
                        onClick={() => markBest(a.id)}
                        title="Mark as best answer"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No answers yet. Be the first to answer.</p>
          )}

          {/* Add answer form */}
          <div className="space-y-2 pt-1 border-t">
            <p className="text-xs font-medium">Add an answer</p>
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer, approved response, or guidance…"
              rows={3}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Input
                value={answeredBy}
                onChange={(e) => setAnsweredBy(e.target.value)}
                placeholder="Your name (optional)"
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" onClick={submitAnswer} disabled={!answerText.trim() || submitting} className="h-8">
                {submitting ? 'Posting…' : 'Post Answer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function QAPanel({ featureId }: { featureId: string }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newQ, setNewQ] = useState('')
  const [askedBy, setAskedBy] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/features/${featureId}/questions`)
      .then((r) => r.json())
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [featureId])

  const postQuestion = async () => {
    if (!newQ.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/features/${featureId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQ.trim(), askedBy: askedBy.trim() }),
      })
      if (!res.ok) throw new Error()
      const q = await res.json()
      setQuestions((prev) => [q, ...prev])
      setNewQ('')
      setAskedBy('')
      toast.success('Question posted')
    } catch { toast.error('Failed to post question') }
    finally { setPosting(false) }
  }

  const filtered = questions.filter((q) =>
    !search || q.question.toLowerCase().includes(search.toLowerCase())
  )
  const openCount = questions.filter((q) => q.status === 'OPEN').length
  const answeredCount = questions.filter((q) => q.status === 'ANSWERED').length

  return (
    <div className="space-y-4">
      {/* Ask question */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
        <p className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Ask a question about this feature
        </p>
        <Textarea
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="What does this feature do? How is it configured? Who is it for?…"
          rows={2}
          className="text-sm bg-background"
        />
        <div className="flex items-center gap-2">
          <Input
            value={askedBy}
            onChange={(e) => setAskedBy(e.target.value)}
            placeholder="Your name (optional)"
            className="h-8 text-xs flex-1"
          />
          <Button size="sm" onClick={postQuestion} disabled={!newQ.trim() || posting} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {posting ? 'Posting…' : 'Ask'}
          </Button>
        </div>
      </div>

      {/* Stats + search */}
      {questions.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {answeredCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">{answeredCount} answered</Badge>
            )}
            {openCount > 0 && (
              <Badge variant="secondary" className="text-xs">{openCount} open</Badge>
            )}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <HelpCircle className="h-7 w-7 opacity-30" />
          <p className="text-sm">{search ? 'No questions match' : 'No questions yet'}</p>
          {!search && <p className="text-xs">Be the first to ask something about this feature</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              featureId={featureId}
              onUpdated={(updated) => setQuestions((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setQuestions((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
