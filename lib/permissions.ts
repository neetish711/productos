// ─── Permission System ──────────────────────────────────────────────────────
// Permissions are stored as a JSON array of keys on the User model.
// Super Admins bypass all checks. Senior PMs and PMs have admin-level access.

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
  // Ideas
  CREATE_IDEAS: 'create_ideas',
  // Admin
  MANAGE_USERS: 'manage_users',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_PERMISSIONS: 'manage_permissions',
  MANAGE_PENDING_REQUESTS: 'manage_pending_requests',
  ASSIGN_SENIOR_PM: 'assign_senior_pm',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS)

// ─── Role Hierarchy ─────────────────────────────────────────────────────────
// Level 1: SUPER_ADMIN — Full system access
// Level 2: SENIOR_PM — Admin for assigned products + manage PMs
// Level 3: PM — Admin for assigned product areas
// Level 4: CSM / SALES / PSD / ENGINEERING — View + create ideas only

export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  SENIOR_PM: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.CREATE_ROADMAP, PERMISSIONS.EDIT_ROADMAP, PERMISSIONS.DELETE_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.CREATE_COMPETITORS, PERMISSIONS.EDIT_COMPETITORS, PERMISSIONS.DELETE_COMPETITORS,
    PERMISSIONS.VIEW_PRDS, PERMISSIONS.CREATE_PRDS, PERMISSIONS.EDIT_PRDS, PERMISSIONS.DELETE_PRDS,
    PERMISSIONS.VIEW_FEATURES, PERMISSIONS.CREATE_FEATURES, PERMISSIONS.EDIT_FEATURES, PERMISSIONS.DELETE_FEATURES,
    PERMISSIONS.SUBMIT_FOR_REVIEW, PERMISSIONS.APPROVE_STORY, PERMISSIONS.REJECT_STORY,
    PERMISSIONS.CREATE_IDEAS,
    PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_PERMISSIONS, PERMISSIONS.MANAGE_PENDING_REQUESTS,
  ],
  PM: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.CREATE_ROADMAP, PERMISSIONS.EDIT_ROADMAP, PERMISSIONS.DELETE_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.CREATE_COMPETITORS, PERMISSIONS.EDIT_COMPETITORS, PERMISSIONS.DELETE_COMPETITORS,
    PERMISSIONS.VIEW_PRDS, PERMISSIONS.CREATE_PRDS, PERMISSIONS.EDIT_PRDS, PERMISSIONS.DELETE_PRDS,
    PERMISSIONS.VIEW_FEATURES, PERMISSIONS.CREATE_FEATURES, PERMISSIONS.EDIT_FEATURES, PERMISSIONS.DELETE_FEATURES,
    PERMISSIONS.SUBMIT_FOR_REVIEW, PERMISSIONS.APPROVE_STORY, PERMISSIONS.REJECT_STORY,
    PERMISSIONS.CREATE_IDEAS,
    PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_PENDING_REQUESTS,
  ],
  CSM: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.VIEW_PRDS, PERMISSIONS.VIEW_FEATURES,
    PERMISSIONS.CREATE_IDEAS,
  ],
  SALES: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.VIEW_PRDS, PERMISSIONS.VIEW_FEATURES,
    PERMISSIONS.CREATE_IDEAS,
  ],
  PSD: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.VIEW_PRDS, PERMISSIONS.VIEW_FEATURES,
    PERMISSIONS.CREATE_IDEAS,
  ],
  ENGINEERING: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.VIEW_PRDS, PERMISSIONS.VIEW_FEATURES,
    PERMISSIONS.CREATE_IDEAS,
  ],
  // Legacy roles mapped
  ADMIN: [...ALL_PERMISSIONS],
  EDITOR: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.CREATE_ROADMAP, PERMISSIONS.EDIT_ROADMAP,
    PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.CREATE_COMPETITORS, PERMISSIONS.EDIT_COMPETITORS,
    PERMISSIONS.VIEW_PRDS, PERMISSIONS.CREATE_PRDS, PERMISSIONS.EDIT_PRDS,
    PERMISSIONS.VIEW_FEATURES, PERMISSIONS.CREATE_FEATURES, PERMISSIONS.EDIT_FEATURES,
    PERMISSIONS.SUBMIT_FOR_REVIEW, PERMISSIONS.CREATE_IDEAS,
  ],
  VIEWER: [
    PERMISSIONS.VIEW_ROADMAP, PERMISSIONS.VIEW_COMPETITORS, PERMISSIONS.VIEW_PRDS, PERMISSIONS.VIEW_FEATURES,
    PERMISSIONS.CREATE_IDEAS,
  ],
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SENIOR_PM: 'Senior Product Manager',
  PM: 'Product Manager',
  CSM: 'CSM',
  SALES: 'Sales',
  PSD: 'PSD',
  ENGINEERING: 'Engineering',
  ADMIN: 'Admin (Legacy)',
  EDITOR: 'Editor (Legacy)',
  VIEWER: 'Viewer (Legacy)',
}

export const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 1,
  SENIOR_PM: 2,
  PM: 3,
  CSM: 4,
  SALES: 4,
  PSD: 4,
  ENGINEERING: 4,
  ADMIN: 1,
  EDITOR: 3,
  VIEWER: 4,
}

// Roles that can see the admin panel
export const ADMIN_PANEL_ROLES = ['SUPER_ADMIN', 'SENIOR_PM', 'PM', 'ADMIN']

// Departments for registration
export const DEPARTMENTS = [
  { value: 'PRODUCT', label: 'Product Management' },
  { value: 'CSM', label: 'Customer Success' },
  { value: 'SALES', label: 'Sales' },
  { value: 'PSD', label: 'Product Strategy & Design' },
  { value: 'ENGINEERING', label: 'Engineering' },
  { value: 'OTHER', label: 'Other' },
]

// Map department to default role
export const DEPARTMENT_ROLE_MAP: Record<string, string> = {
  PRODUCT: 'PM',
  CSM: 'CSM',
  SALES: 'SALES',
  PSD: 'PSD',
  ENGINEERING: 'ENGINEERING',
  OTHER: 'VIEWER',
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
  create_ideas: { label: 'Create Ideas', module: 'Ideas', action: 'Create' },
  manage_users: { label: 'Manage Users', module: 'Admin', action: 'Manage' },
  manage_products: { label: 'Manage Products', module: 'Admin', action: 'Manage' },
  manage_permissions: { label: 'Manage Permissions', module: 'Admin', action: 'Manage' },
  manage_pending_requests: { label: 'Manage Pending Requests', module: 'Admin', action: 'Manage' },
  assign_senior_pm: { label: 'Assign Senior PM', module: 'Admin', action: 'Assign' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

export function isSuperAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN'
}

export function canAccessAdminPanel(role: string): boolean {
  return ADMIN_PANEL_ROLES.includes(role)
}

export function hasPermission(userRole: string, userPermissions: string[], permission: PermissionKey): boolean {
  if (isAdmin(userRole)) return true
  return userPermissions.includes(permission)
}

export function hasAnyPermission(userRole: string, userPermissions: string[], permissions: PermissionKey[]): boolean {
  if (isAdmin(userRole)) return true
  return permissions.some((p) => userPermissions.includes(p))
}

export function canAssignRole(assignerRole: string, targetRole: string): boolean {
  const assignerLevel = ROLE_HIERARCHY[assignerRole] ?? 99
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 99
  // Can only assign roles below your level
  // Exception: only SUPER_ADMIN can assign SENIOR_PM
  if (targetRole === 'SENIOR_PM' && assignerRole !== 'SUPER_ADMIN') return false
  return assignerLevel < targetLevel
}

export function getAssignableRoles(assignerRole: string): string[] {
  return Object.keys(ROLE_HIERARCHY).filter((role) => {
    if (role === 'ADMIN' || role === 'EDITOR' || role === 'VIEWER') return false // Hide legacy roles
    return canAssignRole(assignerRole, role)
  })
}
