'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Building2, Users, Shield, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Org { id: string; name: string; slug: string; createdAt: Date }
interface User { id: string; name: string | null; email: string; role: string; createdAt: Date }

interface Props {
  org: Org
  users: User[]
  currentUserId: string
}

export function SettingsClient({ org, users, currentUserId }: Props) {
  const router = useRouter()
  const [orgName, setOrgName] = useState(org.name)
  const [saving, setSaving] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const saveOrg = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      })
      if (!res.ok) throw new Error()
      toast.success('Organization updated')
      router.refresh()
    } catch {
      toast.error('Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast.success('Password changed')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e: any) {
      toast.error(e.message || 'Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your organization and account settings</p>
      </div>

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">
            <Building2 className="h-4 w-4 mr-2" />Organization
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="h-4 w-4 mr-2" />Team
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Update your organization name and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} className="max-w-sm mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground">Organization ID</Label>
                <p className="text-sm font-mono mt-1">{org.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Slug</Label>
                <p className="text-sm font-mono mt-1">{org.slug}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="text-sm mt-1">{formatDateTime(org.createdAt)}</p>
              </div>
              <Button onClick={saveOrg} disabled={saving || orgName === org.name}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>{users.length} member(s) in your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name || 'No name'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                        {user.role}
                      </Badge>
                      {user.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-sm">
              <div>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <Button onClick={changePassword} disabled={pwSaving || !pwForm.current || !pwForm.next}>
                {pwSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
