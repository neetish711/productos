'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Shield } from 'lucide-react'
import {
  ROLE_LABELS,
  PERMISSION_LABELS,
  ROLE_DEFAULTS,
  ALL_PERMISSIONS,
} from '@/lib/permissions'

const roles = Object.keys(ROLE_LABELS)

// Group permissions by module for better readability
function groupByModule() {
  const groups: Record<string, { key: string; label: string; action: string }[]> = {}
  for (const perm of ALL_PERMISSIONS) {
    const info = PERMISSION_LABELS[perm]
    if (!info) continue
    if (!groups[info.module]) groups[info.module] = []
    groups[info.module].push({ key: perm, label: info.label, action: info.action })
  }
  return groups
}

export default function PermissionsPage() {
  const modules = groupByModule()

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This matrix shows the default permissions for each role. These are assigned automatically when a user is given a role.
          To customize permissions for individual users, go to the <strong>Users</strong> tab and edit the user directly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Role-Permission Matrix</CardTitle>
              <CardDescription>
                Default permissions assigned to each role. Checkboxes are read-only.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] sticky left-0 bg-background">Permission</TableHead>
                  {roles.map((role) => (
                    <TableHead key={role} className="text-center min-w-[120px]">
                      {ROLE_LABELS[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(modules).map(([module, perms]) => (
                  <>
                    <TableRow key={`module-${module}`}>
                      <TableCell
                        colSpan={roles.length + 1}
                        className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2"
                      >
                        {module}
                      </TableCell>
                    </TableRow>
                    {perms.map((perm) => (
                      <TableRow key={perm.key}>
                        <TableCell className="sticky left-0 bg-background text-sm">
                          {perm.action}
                        </TableCell>
                        {roles.map((role) => {
                          const defaults = ROLE_DEFAULTS[role] ?? []
                          const hasIt = defaults.includes(perm.key as any)
                          return (
                            <TableCell key={`${perm.key}-${role}`} className="text-center">
                              <Checkbox
                                checked={hasIt}
                                disabled
                                aria-label={`${ROLE_LABELS[role]} - ${perm.label}`}
                                className="pointer-events-none"
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Permissions Work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Super Admin</strong> and <strong>Admin</strong> roles bypass all permission checks and have full access to the system.
          </p>
          <p>
            Other roles (<strong>Product Manager</strong>, <strong>Editor</strong>, <strong>Viewer</strong>) receive default permissions as shown in the matrix above. These defaults are applied when a user is assigned a role.
          </p>
          <p>
            You can customize permissions for individual users by editing them in the <strong>Users</strong> tab. Custom permissions override the role defaults for that specific user.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
