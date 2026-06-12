'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, Package, Swords, Key, Upload, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 0, icon: Building2, label: 'Organization', title: 'Set up your organization' },
  { id: 1, icon: Package, label: 'Product', title: 'Define your product' },
  { id: 2, icon: Swords, label: 'Competitors', title: 'Add competitors' },
  { id: 3, icon: Key, label: 'AI Setup', title: 'Configure AI provider' },
  { id: 4, icon: Upload, label: 'Import', title: 'Import existing data' },
]

interface Props {
  userId: string
  orgId: string
  currentStep: number
}

export function OnboardingWizard({ userId, orgId, currentStep: initial }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(initial)
  const [saving, setSaving] = useState(false)

  // Form state per step
  const [orgName, setOrgName] = useState('')
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [competitors, setCompetitors] = useState([{ name: '', website: '' }])
  const [aiProvider, setAiProvider] = useState('ANTHROPIC')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6')

  const PROVIDER_MODELS: Record<string, string[]> = {
    OPENAI: ['gpt-4o', 'gpt-4o-mini'],
    ANTHROPIC: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    GEMINI: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  }

  const progress = Math.round(((step) / STEPS.length) * 100)

  const addCompetitor = () => setCompetitors(prev => [...prev, { name: '', website: '' }])
  const updateCompetitor = (i: number, field: string, val: string) => {
    setCompetitors(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }
  const removeCompetitor = (i: number) => setCompetitors(prev => prev.filter((_, idx) => idx !== i))

  const saveStep = async () => {
    setSaving(true)
    try {
      let payload: any = { step }
      if (step === 0) payload.orgName = orgName
      if (step === 1) payload = { step, productName, productDesc }
      if (step === 2) payload = { step, competitors: competitors.filter(c => c.name) }
      if (step === 3) payload = { step, aiProvider, aiKey, aiModel }
      if (step === 4) payload = { step, skipImport: true }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()

      if (step === STEPS.length - 1) {
        toast.success('Setup complete! Welcome to ProductOS')
        router.push('/dashboard')
      } else {
        setStep(prev => prev + 1)
      }
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canContinue = () => {
    if (step === 0) return orgName.length > 0
    if (step === 1) return productName.length > 0
    return true // Competitors, AI, Import all optional
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome to ProductOS</h1>
          <p className="text-muted-foreground mt-2">Let's get you set up in 5 quick steps</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-between mb-6">
          {STEPS.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  s.id < step ? 'bg-primary text-primary-foreground' :
                  s.id === step ? 'bg-primary/20 text-primary border-2 border-primary' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {s.id < step ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{s.label}</span>
              </div>
            )
          })}
        </div>

        <Progress value={progress} className="mb-8 h-1.5" />

        {/* Step content */}
        <div className="bg-card rounded-xl border p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-semibold">{STEPS[step]?.title}</h2>
          </div>

          {/* Step 0: Org */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Organization Name *</Label>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">This is how your team will identify this workspace</p>
              </div>
            </div>
          )}

          {/* Step 1: Product */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="AcmeSupport AI"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={productDesc}
                  onChange={e => setProductDesc(e.target.value)}
                  placeholder="AI-powered customer support platform..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Competitors */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Add 1-3 key competitors to start monitoring</p>
              {competitors.map((comp, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={comp.name}
                    onChange={e => updateCompetitor(i, 'name', e.target.value)}
                    placeholder="Zendesk"
                    className="flex-1"
                  />
                  <Input
                    value={comp.website}
                    onChange={e => updateCompetitor(i, 'website', e.target.value)}
                    placeholder="https://zendesk.com"
                    className="flex-1"
                  />
                  {i > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCompetitor(i)}>✕</Button>
                  )}
                </div>
              ))}
              {competitors.length < 5 && (
                <Button variant="outline" size="sm" onClick={addCompetitor}>
                  + Add another
                </Button>
              )}
              <p className="text-xs text-muted-foreground">You can add more competitors later</p>
            </div>
          )}

          {/* Step 3: AI */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Add an AI provider API key to enable spec generation and competitive intelligence</p>
              <div>
                <Label>Provider</Label>
                <Select value={aiProvider} onValueChange={v => {
                  setAiProvider(v)
                  setAiModel(PROVIDER_MODELS[v]?.[0] ?? '')
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ANTHROPIC', 'OPENAI', 'GEMINI'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={aiKey}
                  onChange={e => setAiKey(e.target.value)}
                  placeholder="sk-..."
                  className="mt-1"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">Encrypted with AES-256-GCM. You can skip this and add later.</p>
              </div>
              <div>
                <Label>Default Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(PROVIDER_MODELS[aiProvider] || []).map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 4: Import */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You can import existing roadmap and competitive analysis data from Excel/CSV files.
                You can also do this later from the app.
              </p>
              <div className="flex flex-col gap-2">
                <div className="p-4 rounded-lg border border-dashed flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8 opacity-40" />
                  <p className="text-sm">File import available in the app after setup</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Click "Complete Setup" to finish and start using ProductOS</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep(prev => prev - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button onClick={saveStep} disabled={saving || !canContinue()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {step === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
              {step < STEPS.length - 1 && !saving && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can always configure everything later in Settings
        </p>
      </div>
    </div>
  )
}
