// ─── Permission System ──────────────────────────────────────────────────────
// Permissions are stored as a JSON array of keys on the User model.
// Super Admins (role=SUPER_ADMIN or ADMIN) bypass all checks.

export const PERMISSIONS = {
  // Roadmap
  VIEW_ROADMAP: 'view_roadmap',
  CREATE_ROADMAP: 'create_roadmap',
  EDIT_ROADMAP: 'edit_roadmap',
  DELETE_ROADMAP: 'delete_roadmap',
  // Competitive Analysis
  VIEW_COMPETITORS: 'view_competitors',
  CREATE_COMPETITORS: 'create_competitors',
  EDIT_COMPETITORS: 'edit_competitors',
  DELETE_COMPETITORS: 'delete_competitors',
  // PRDs / Specs
  VIEW_PRDS: 'view_prds',
  CREATE_PRDS: 'create_prds',
  EDIT_PRDS: 'edit_prds',
  DELETE_PRDS: 'delete_prds',
  // Story / Review
  SUBMIT_FOR_REVIEW: 'submit_for_review',
  APPROVE_STORY: 'approve_story',
  REJECT_STORY: 'reject_story',
  // Features
  VIEW_FEATURES: 'view_features',
  CREATE_FEATURES: 'create_features',
  EDIT_FEATURES: 'edit_features',
  DELETE_FEATURES: 'delete_features',
  // Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_PERMISSIONS: 'manage_permissions',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS)

// ─── Default permissions per role ───────────────────────────────────────────

export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  ADMIN: [...ALL_PERMISSIONS],
  PM: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.CREATE_ROADMAP, PERMISSIONS.EDIT_ROADMAP, PERMISSIONS.DELETE_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.CREATE_COMPETITORS, PERMISSIONS.EDIT_COMPETITORS, PERMISSIONS.DELETE_COMPETITORS,
    PERMISSIONS.VIEW_PRDS, PERMISSIONS.CREATE_PRDS, PERMISSIONS.EDIT_PRDS, PERMISSIONS.DELETE_PRDS,
    PERMISSIONS.VIEW_FEATURES, PERMISSIONS.CREATE_FEATURES, PERMISSIONS.EDIT_FEATURES, PERMISSIONS.DELETE_FEATURES,
    PERMISSIONS.SUBMIT_FOR_REVIEW, PERMISSIONS.APPROVE_STORY, PERMISSIONS.REJECT_STORY,
  ],
  EDITOR: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.CREATE_ROADMAP, PERMISSIONS.EDIT_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.CREATE_COMPETITORS, PERMISSIONS.EDIT_COMPETITORS,
    PERMISSIONS.VIEW_PRDS, PERMISSIONS.CREATE_PRDS, PERMISSIONS.EDIT_PRDS,
    PERMISSIONS.VIEW_FEATURES, PERMISSIONS.CREATE_FEATURES, PERMISSIONS.EDIT_FEATURES,
    PERMISSIONS.SUBMIT_FOR_REVIEW,
  ],
  VIEWER: [
    PERMISSIONS.VIEW_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS,
    PERMISSIONS.VIEW_PRDS,
    PERMISSIONS.VIEW_FEATURES,
  ],
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  PM: 'Product Manager',
  EDITOR: 'Editor / Contributor',
  VIEWER: 'Viewer',
}

export const PERMISSION_LABELS: Record<string, { label: string; module: string; action: string }> = {
  view_roadmap: { label: 'View Roadmap', module: 'Roadmap', action: 'View' },
  create_roadmap: { label: 'Create Roadmap', module: 'Roadmap', action: 'Create' },
  edit_roadmap: { label: 'Edit Roadmap', module: 'Roadmap', action: 'Edit' },
  delete_roadmap: { label: 'Delete Roadmap', module: 'Roadmap', action: 'Delete' },
  view_competitors: { label: 'View Competitive Analysis', module: 'Competitors', action: 'View' },
  create_competitors: { label: 'Create Competitive Analysis', module: 'Competitors', action: 'Create' },
  edit_competitors: { label: 'Edit Competitive Analysis', module: 'Competitors', action: 'Edit' },
  delete_competitors: { label: 'Delete Competitive Analysis', module: 'Competitors', action: 'Delete' },
  view_prds: { label: 'View PRDs', module: 'Specs', action: 'View' },
  create_prds: { label: 'Create PRDs', module: 'Specs', action: 'Create' },
  edit_prds: { label: 'Edit PRDs', module: 'Specs', action: 'Edit' },
  delete_prds: { label: 'Delete PRDs', module: 'Specs', action: 'Delete' },
  submit_for_review: { label: 'Submit for Review', module: 'Review', action: 'Submit' },
  approve_story: { label: 'Approve Story', module: 'Review', action: 'Approve' },
  reject_story: { label: 'Reject Story', module: 'Review', action: 'Reject' },
  view_features: { label: 'View Features', module: 'Features', action: 'View' },
  create_features: { label: 'Create Features', module: 'Features', action: 'Create' },
  edit_features: { label: 'Edit Features', module: 'Features', action: 'Edit' },
  delete_features: { label: 'Delete Features', module: 'Features', action: 'Delete' },
  manage_users: { label: 'Manage Users', module: 'Admin', action: 'Manage' },
  manage_products: { label: 'Manage Products', module: 'Admin', action: 'Manage' },
  manage_permissions: { label: 'Manage Permissions', module: 'Admin', action: 'Manage' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

export function hasPermission(userRole: string, userPermissions: string[], permission: PermissionKey): boolean {
  if (isAdmin(userRole)) return true
  return userPermissions.includes(permission)
}

export function hasAnyPermission(userRole: string, userPermissions: string[], permissions: PermissionKey[]): boolean {
  if (isAdmin(userRole)) return true
  return permissions.some((p) => userPermissions.includes(p))
}
