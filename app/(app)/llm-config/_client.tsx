'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Trash2, TestTube2, CheckCircle2, XCircle, Loader2, Key, Cpu } from 'lucide-react'

const PROVIDER_MODELS: Record<string, string[]> = {
  OPENAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ANTHROPIC: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  GEMINI: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
}

const PROVIDER_COLORS: Record<string, string> = {
  OPENAI: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  ANTHROPIC: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  GEMINI: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
}

interface LLMConfig {
  id: string
  provider: string
  label: string
  defaultModel: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Props {
  configs: LLMConfig[]
  orgId: string
}

export function LLMConfigClient({ configs: initial, orgId }: Props) {
  const router = useRouter()
  const [configs, setConfigs] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [form, setForm] = useState({
    provider: 'ANTHROPIC',
    label: '',
    apiKey: '',
    defaultModel: 'claude-sonnet-4-6',
    isActive: true,
  })

  const handleAdd = async () => {
    if (!form.apiKey.trim()) {
      toast.error('API key is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/llm-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          // Send provider as label fallback if user left it blank
          label: form.label.trim() || form.provider,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      setConfigs(prev => {
        const updated = form.isActive ? prev.map(c => ({ ...c, isActive: false })) : prev
        return [data, ...updated]
      })
      setShowAdd(false)
      setForm({ provider: 'ANTHROPIC', label: '', apiKey: '', defaultModel: 'claude-sonnet-4-6', isActive: true })
      toast.success('LLM configuration added')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this configuration?')) return
    const res = await fetch(`/api/llm-configs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setConfigs(prev => prev.filter(c => c.id !== id))
      toast.success('Configuration deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const handleSetActive = async (id: string) => {
    const res = await fetch(`/api/llm-configs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) {
      setConfigs(prev => prev.map(c => ({ ...c, isActive: c.id === id })))
      toast.success('Set as active provider')
      router.refresh()
    } else {
      toast.error('Failed to set active')
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/llm-configs/${id}`, {
        method: 'POST', // test connection endpoint
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const result = await res.json()
      setTestResult(prev => ({ ...prev, [id]: result }))
      if (result.ok) {
        toast.success('Connection successful!')
      } else {
        toast.error(`Connection failed: ${result.message}`)
      }
    } catch {
      setTestResult(prev => ({ ...prev, [id]: { ok: false, message: 'Test request failed' } }))
      toast.error('Test failed')
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LLM Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure AI providers. API keys are encrypted at rest with AES-256-GCM.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="font-semibold">No AI providers configured</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Add an API key to enable AI features throughout the app
            </p>
            <Button className="mt-4" onClick={() => setShowAdd(true)}>
              Add Provider
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const result = testResult[config.id]
            return (
              <Card key={config.id} className={config.isActive ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-semibold ${PROVIDER_COLORS[config.provider] || 'bg-muted'}`}>
                        {config.provider}
                      </div>
                      <CardTitle className="text-base">{config.label || config.provider}</CardTitle>
                      {config.isActive && <Badge className="text-xs">Active</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {result && (
                        result.ok
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(config.id)}
                        disabled={!!testing}
                      >
                        {testing === config.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <TestTube2 className="h-3.5 w-3.5 mr-1" />}
                        Test
                      </Button>
                      {!config.isActive && (
                        <Button variant="outline" size="sm" onClick={() => handleSetActive(config.id)}>
                          Set Active
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      {config.defaultModel}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      API key stored encrypted
                    </div>
                  </div>
                  {result && (
                    <p className={`text-xs mt-2 ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                      {result.message}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add LLM Provider</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={v => setForm(p => ({
                  ...p, provider: v,
                  defaultModel: PROVIDER_MODELS[v]?.[0] ?? '',
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['OPENAI', 'ANTHROPIC', 'GEMINI'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder={`My ${form.provider} key`}
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-..."
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Encrypted with AES-256-GCM before storage
              </p>
            </div>
            <div>
              <Label>Default Model</Label>
              <Select
                value={form.defaultModel}
                onValueChange={v => setForm(p => ({ ...p, defaultModel: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODELS[form.provider] || []).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))}
              />
              <Label>Set as active provider</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.apiKey}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
