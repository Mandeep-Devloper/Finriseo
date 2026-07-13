import { describe, it, expect } from 'vitest';
import { can, capabilitiesFor, ROLES, type Capability } from '@/lib/auth/permissions';

// These lock the RBAC matrix so a careless edit that widens a role's power fails
// CI. The server gate (requireAdmin + can) is authoritative; this proves the map.

describe('RBAC capability matrix', () => {
  it('AGENT is front-line only (view/status/note) — nothing sensitive', () => {
    expect(can('AGENT', 'view_leads')).toBe(true);
    expect(can('AGENT', 'change_status')).toBe(true);
    expect(can('AGENT', 'add_note')).toBe(true);
    for (const cap of ['export', 'lender_crud', 'team_manage', 'settings', 'record_disbursement', 'dashboard', 'audit_view'] as Capability[]) {
      expect(can('AGENT', cap)).toBe(false);
    }
  });

  it('ADMIN runs operations but CANNOT manage the team or settings', () => {
    expect(can('ADMIN', 'export')).toBe(true);
    expect(can('ADMIN', 'record_disbursement')).toBe(true);
    expect(can('ADMIN', 'lender_crud')).toBe(true);
    expect(can('ADMIN', 'dashboard')).toBe(true);
    expect(can('ADMIN', 'team_manage')).toBe(false);
    expect(can('ADMIN', 'settings')).toBe(false);
  });

  it('SUPER_ADMIN can do everything, including team_manage + settings', () => {
    expect(can('SUPER_ADMIN', 'team_manage')).toBe(true);
    expect(can('SUPER_ADMIN', 'settings')).toBe(true);
  });

  it('is strictly nested: AGENT ⊂ ADMIN ⊂ SUPER_ADMIN (least privilege)', () => {
    const agent = new Set(capabilitiesFor('AGENT'));
    const admin = new Set(capabilitiesFor('ADMIN'));
    const superAdmin = new Set(capabilitiesFor('SUPER_ADMIN'));
    for (const c of agent) expect(admin.has(c)).toBe(true);
    for (const c of admin) expect(superAdmin.has(c)).toBe(true);
    expect(admin.size).toBeGreaterThan(agent.size);
    expect(superAdmin.size).toBeGreaterThan(admin.size);
  });

  it('exposes all three roles in privilege order', () => {
    expect(ROLES).toEqual(['SUPER_ADMIN', 'ADMIN', 'AGENT']);
  });
});
