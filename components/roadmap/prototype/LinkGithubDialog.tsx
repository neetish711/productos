'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Github, Loader2, GitBranch } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  itemId: string
  publishId: string
  existingRepo?: string | null
  existingBranch?: string | null
  onLinked: (repo: string, branch: string) => void
}

export function LinkGithubDialog({ open, onClose, itemId, publishId, existingRepo, existingBranch, onLinked }: Props) {
  const [repo,   setRepo]   = useState(existingRepo ?? '')
  const [branch, setBranch] = useState(existingBranch ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!repo.trim() || !branch.trim()) return
    if (!repo.startsWith('http')) {
      toast.error('Please enter a valid GitHub URL starting with http')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/roadmap/${itemId}/lovable/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishId, githubRepoUrl: repo.trim(), githubBranch: branch.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to link')
      toast.success('GitHub repository linked!')
      onLinked(repo.trim(), branch.trim())
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to link GitHub repository')
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
            Link GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Link the GitHub repository and branch connected to this Lovable prototype.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Where to find this:</p>
            <p>In your Lovable project, go to <span className="font-mono bg-muted px-1 rounded">Settings → GitHub</span> to connect and sync a repository. Copy the repo URL and branch from there.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="github-repo">Repository URL</Label>
            <Input
              id="github-repo"
              placeholder="https://github.com/org/repo-name"
              value={repo}
              onChange={e => setRepo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="github-branch">Branch</Label>
            <div className="relative">
              <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="github-branch"
                placeholder="main"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="pl-8"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use the branch Lovable syncs to, typically <span className="font-mono">main</span> or a feature branch.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!repo.trim() || !branch.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
              Link Repository
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
