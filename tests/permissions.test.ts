import { describe, it, expect } from 'vitest'
import { canAssignRole, hasPermission, isAdmin } from '@/lib/permissions'

// AUDIT S4-ci: guards for the RBAC fixes from Sprint 1/4.
describe('canAssignRole', () => {
  it('lets SUPER_ADMIN assign lower roles', () => {
    expect(canAssignRole('SUPER_ADMIN', 'PM')).toBe(true)
    expect(canAssignRole('SUPER_ADMIN', 'SENIOR_PM')).toBe(true)
  })
  it('blocks a PM from assigning SUPER_ADMIN (privilege escalation)', () => {
    expect(canAssignRole('PM', 'SUPER_ADMIN')).toBe(false)
  })
  it('blocks assigning a peer-level role', () => {
    expect(canAssignRole('PM', 'PM')).toBe(false)
  })
  it('only SUPER_ADMIN may assign SENIOR_PM', () => {
    expect(canAssignRole('SENIOR_PM', 'SENIOR_PM')).toBe(false)
  })
})

describe('isAdmin (legacy ADMIN bypass removed)', () => {
  it('is true only for SUPER_ADMIN', () => {
    expect(isAdmin('SUPER_ADMIN')).toBe(true)
    expect(isAdmin('ADMIN')).toBe(false)
    expect(isAdmin('PM')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('SUPER_ADMIN bypasses explicit permission checks', () => {
    expect(hasPermission('SUPER_ADMIN', [], 'approve_story')).toBe(true)
  })
  it('non-admin requires the explicit permission', () => {
    expect(hasPermission('CSM', [], 'approve_story')).toBe(false)
    expect(hasPermission('PM', ['approve_story'], 'approve_story')).toBe(true)
  })
})
