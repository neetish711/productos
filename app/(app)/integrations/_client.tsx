'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  MessageSquare, FileSpreadsheet, Webhook,
  Loader2, Github, Sparkles, CheckCircle2, XCircle, AlertTriangle,
  Eye, EyeOff, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type IntegrationStatus = {
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'CONNECTION_ERROR' | 'RECONNECT_REQUIRED'
  connected: boolean
  connectedAt?: string | null
  lastTestedAt?: string | null
  errorMessage?: string | null
  maskedKey?: string | null
  configJson?: Record<string, any>
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function StatusPill({ status }: { status: IntegrationStatus['status'] }) {
  if (status === 'CONNECTED') return (
    <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />Connected
    </Badge>
  )
  if (status === 'CONNECTION_ERROR') return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />Error
    </Badge>
  )
  if (status === 'RECONNECT_REQUIRED') return (
    <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
      <AlertTriangle className="h-3 w-3" />Reconnect Required
    </Badge>
  )
  return null
}

/* ─── Lovable Connect Dialog ──────────────────────────────────────────────── */
function LovableDialog({
  open, onClose, onConnected,
}: {
  open: boolean; onClose: () => void; onConnected: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/lovable/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to connect')
      toast.success('Lovable integration connected!')
      onConnected()
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to connect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Connect Lovable
          </DialogTitle>
          <DialogDescription>
            Link your Lovable account so ProductOS can track prototypes published to Lovable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Where to find your API key:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to <span className="font-mono bg-muted px-1 rounded">lovable.dev</span> and sign in</li>
              <li>Navigate to <span className="font-mono bg-muted px-1 rounded">Account → API Keys</span></li>
              <li>Create a new key and paste it below</li>
            </ol>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lovable-key">Lovable API Key</Label>
            <div className="relative">
              <Input
                id="lovable-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-lov-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!apiKey.trim() || saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── GitHub Connect Dialog ───────────────────────────────────────────────── */
function GithubDialog({
  open, onClose, onConnected,
}: {
  open: boolean; onClose: () => void; onConnected: () => void
}) {
  const [pat, setPat] = useState('')
  const [showPat, setShowPat] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!pat.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalAccessToken: pat.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect')
      toast.success(`GitHub connected${data.githubLogin ? ` as @${data.githubLogin}` : ''}!`)
      onConnected()
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to connect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            Connect GitHub
          </DialogTitle>
          <DialogDescription>
            Link a GitHub Personal Access Token so roadmap items can reference their Lovable-synced repositories.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Where to create a token:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Go to <span className="font-mono bg-muted px-1 rounded">github.com → Settings → Developer settings</span></li>
              <li>Choose <span className="font-mono bg-muted px-1 rounded">Personal access tokens → Fine-grained tokens</span></li>
              <li>Grant <span className="font-mono bg-muted px-1 rounded">Contents: Read</span> on the relevant repos</li>
              <li>Copy and paste the token below</li>
            </ol>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-pat">Personal Access Token</Label>
            <div className="relative">
              <Input
                id="gh-pat"
                type={showPat ? 'text' : 'password'}
                placeholder="github_pat_..."
                value={pat}
                onChange={e => setPat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPat(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!pat.trim() || saving} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Prototype Integration Card ──────────────────────────────────────────── */
function PrototypeIntegrationCard({
  id, name, description, Icon, iconBg, iconColor, status, loading,
  onConnect, onDisconnect, onTest, connectedAt, lastTestedAt, errorMessage, configJson,
}: {
  id: string
  name: string
  description: string
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  status: IntegrationStatus
  loading: boolean
  onConnect: () => void
  onDisconnect: () => void
  onTest: () => void
  connectedAt?: string | null
  lastTestedAt?: string | null
  errorMessage?: string | null
  configJson?: Record<string, any>
}) {
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    try {
      await onTest()
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn('p-2.5 rounded-lg shrink-0', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{name}</h3>
              <Badge variant="secondary" className="text-xs">Prototype</Badge>
              {!loading && <StatusPill status={status.status} />}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>

            {status.connected && (
              <div className="mt-2 space-y-0.5">
                {configJson?.githubLogin && (
                  <p className="text-xs text-muted-foreground">Authenticated as <span className="font-mono">@{configJson.githubLogin}</span></p>
                )}
                {connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(connectedAt).toLocaleDateString()}
                    {lastTestedAt && ` · Last tested ${new Date(lastTestedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            )}

            {(status.status === 'CONNECTION_ERROR' || status.status === 'RECONNECT_REQUIRED') && errorMessage && (
              <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status.connected ? (
              <>
                <Button
                  variant="outline" size="sm"
                  onClick={handleTest}
                  disabled={testing}
                  className="gap-1.5"
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Test
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disconnect'}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onConnect} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Main Client ─────────────────────────────────────────────────────────── */
export function IntegrationsClient() {
  // Prototype integrations state
  const [integrationStatus, setIntegrationStatus] = useState<{ lovable: IntegrationStatus; github: IntegrationStatus } | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [showLovableDialog, setShowLovableDialog] = useState(false)
  const [showGithubDialog, setShowGithubDialog] = useState(false)

  // Notifications integrations state (existing)
  const [showGChatSetup, setShowGChatSetup] = useState(false)
  const [gchatEnabled, setGchatEnabled] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [gchatTesting, setGchatTesting] = useState(false)
  const [gchatSaving, setGchatSaving] = useState(false)

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/integrations/status')
      if (res.ok) {
        const data = await res.json()
        setIntegrationStatus(data)
        // AUDIT S3-4: reflect the real persisted Google Chat state on load.
        if (data.googleChat?.connected) setGchatEnabled(true)
      }
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  const handleTest = async (type: 'lovable' | 'github') => {
    try {
      const res = await fetch(`/api/integrations/${type}/test`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${type === 'lovable' ? 'Lovable' : 'GitHub'} connection verified!`)
      } else {
        toast.error(data.error ?? 'Test failed')
      }
      await loadStatus()
    } catch {
      toast.error('Test failed')
    }
  }

  const handleDisconnect = async (type: 'lovable' | 'github') => {
    try {
      const res = await fetch(`/api/integrations/${type}/disconnect`, { method: 'POST' })
      if (res.ok) {
        toast.success(`${type === 'lovable' ? 'Lovable' : 'GitHub'} disconnected`)
        await loadStatus()
      } else {
        toast.error('Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const testGChat = async () => {
    if (!webhookUrl) { toast.error('Enter webhook URL first'); return }
    setGchatTesting(true)
    try {
      const res = await fetch('/api/integrations/google-chat/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      })
      if (res.ok) toast.success('Test message sent to Google Chat!')
      else toast.error('Test failed — check your webhook URL')
    } catch {
      toast.error('Test failed')
    } finally {
      setGchatTesting(false)
    }
  }

  // AUDIT S3-4: persist via the real connect route (validates + tests + stores
  // the webhook encrypted) instead of just flipping client state.
  const saveGChat = async () => {
    if (!webhookUrl.trim()) { toast.error('Enter a webhook URL first'); return }
    setGchatSaving(true)
    try {
      const res = await fetch('/api/integrations/google-chat/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect')
      setGchatEnabled(true)
      setShowGChatSetup(false)
      toast.success('Google Chat connected')
      await loadStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setGchatSaving(false)
    }
  }

  const disconnectGChat = async () => {
    try {
      const res = await fetch('/api/integrations/google-chat/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error()
      setGchatEnabled(false)
      setWebhookUrl('')
      toast.success('Google Chat disconnected')
      await loadStatus()
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const lovable = integrationStatus?.lovable ?? { status: 'NOT_CONNECTED' as const, connected: false }
  const github  = integrationStatus?.github  ?? { status: 'NOT_CONNECTED' as const, connected: false }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect ProductOS to your existing tools
        </p>
      </div>

      {/* Prototype section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Prototype</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used by the Publish to Lovable workflow — connect these to enable the prototype pipeline.
          </p>
        </div>

        <PrototypeIntegrationCard
          id="lovable"
          name="Lovable"
          description="Publish approved PRDs to Lovable as structured generation prompts and track prototype status"
          Icon={Sparkles}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          iconColor="text-violet-600"
          status={lovable}
          loading={statusLoading}
          onConnect={() => setShowLovableDialog(true)}
          onDisconnect={() => handleDisconnect('lovable')}
          onTest={() => handleTest('lovable')}
          connectedAt={lovable.connectedAt}
          lastTestedAt={lovable.lastTestedAt}
          errorMessage={lovable.errorMessage}
          configJson={lovable.configJson}
        />

        <PrototypeIntegrationCard
          id="github"
          name="GitHub"
          description="Link Lovable-synced GitHub repositories to roadmap items for engineering handoff tracking"
          Icon={Github}
          iconBg="bg-gray-100 dark:bg-gray-800"
          iconColor="text-gray-700 dark:text-gray-300"
          status={github}
          loading={statusLoading}
          onConnect={() => setShowGithubDialog(true)}
          onDisconnect={() => handleDisconnect('github')}
          onTest={() => handleTest('github')}
          connectedAt={github.connectedAt}
          lastTestedAt={github.lastTestedAt}
          errorMessage={github.errorMessage}
          configJson={github.configJson}
        />
      </section>

      {/* Notifications section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notifications</h2>
        </div>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Google Chat</h3>
                <Badge variant="secondary" className="text-xs">Notifications</Badge>
                {gchatEnabled && (
                  <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                    <CheckCircle2 className="h-3 w-3" />Connected
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Post competitor updates and roadmap changes to Google Chat spaces</p>
            </div>
            {gchatEnabled ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowGChatSetup(true)}>Configure</Button>
                <Button variant="ghost" size="sm" onClick={disconnectGChat}>Disconnect</Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowGChatSetup(true)}>Connect</Button>
            )}
          </CardContent>
        </Card>

        {[
          { name: 'Slack', description: 'Send notifications and AI insights to your Slack workspace', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
        ].map(item => (
          <Card key={item.name}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn('p-2.5 rounded-lg shrink-0', item.bg)}>
                <MessageSquare className={cn('h-5 w-5', item.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{item.name}</h3>
                  <Badge variant="secondary" className="text-xs">Notifications</Badge>
                  <Badge variant="outline" className="text-xs">Coming soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Button size="sm" variant="outline" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Data Export section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Data Export</h2>
        </div>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Google Sheets</h3>
                <Badge variant="secondary" className="text-xs">Data Export</Badge>
                <Badge variant="outline" className="text-xs">Coming soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Sync roadmap and competitive data to Google Sheets</p>
            </div>
            <Button size="sm" variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
              <Webhook className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Webhooks</h3>
                <Badge variant="secondary" className="text-xs">Developer</Badge>
                <Badge variant="outline" className="text-xs">Coming soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Trigger custom webhooks on competitor updates and roadmap events</p>
            </div>
            <Button size="sm" variant="outline" disabled>Coming Soon</Button>
          </CardContent>
        </Card>
      </section>

      {/* Dialogs */}
      <LovableDialog
        open={showLovableDialog}
        onClose={() => setShowLovableDialog(false)}
        onConnected={loadStatus}
      />
      <GithubDialog
        open={showGithubDialog}
        onClose={() => setShowGithubDialog(false)}
        onConnected={loadStatus}
      />

      {/* Google Chat Dialog */}
      <Dialog open={showGChatSetup} onOpenChange={setShowGChatSetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Google Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">Setup Instructions</p>
              <ol className="text-blue-700 dark:text-blue-400 space-y-1 text-xs list-decimal ml-4">
                <li>Open Google Chat and navigate to your space</li>
                <li>Click the space name → Manage webhooks</li>
                <li>Click "Add webhook" and copy the URL</li>
                <li>Paste the URL below</li>
              </ol>
            </div>
            <div>
              <Label>Incoming Webhook URL</Label>
              <Input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                className="mt-1"
              />
            </div>
            <Button variant="outline" size="sm" onClick={testGChat} disabled={gchatTesting || !webhookUrl}>
              {gchatTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send Test Message
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGChatSetup(false)}>Cancel</Button>
            <Button onClick={saveGChat} disabled={gchatSaving || !webhookUrl}>
              {gchatSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
