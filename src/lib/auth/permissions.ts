// Single source of truth for the admin role → capability matrix (least
// privilege). Both server routes (via requireAdmin + can()) and the UI (to
// hide/disable controls) reference THIS map, so the gate and the chrome never
// drift. The server check is always authoritative; UI gating is convenience.
//
// This file is edge-safe (no server-only / firebase-admin imports) so middleware
// and client components can import the matrix too.
import type { Role } from '@prisma/client';

export type Capability =
  | 'view_leads'          // see + open the applications/leads list & detail
  | 'change_status'       // move a lead through the pipeline
  | 'add_note'            // add an internal note to a lead
  | 'assign'              // assign a lead to an agent
  | 'export'              // export the filtered lead set (PII leaves the system)
  | 'record_disbursement' // record disbursed amount/date/lender
  | 'lender_crud'         // manage the Lender table (feeds the offers engine)
  | 'dashboard'           // KPI dashboard + analytics
  | 'team_manage'         // invite/deactivate admins & agents, set roles
  | 'audit_view'          // browse the audit log
  | 'contact_inbox'       // view/resolve ContactMessage submissions
  | 'settings';           // business info, default commission, etc.

// Confirmed matrix (recommended least-privilege):
//   AGENT       — front-line: works leads (view/status/note) only.
//   ADMIN       — operations: everything except team management & settings.
//   SUPER_ADMIN — owner: everything.
const MATRIX: Record<Role, Capability[]> = {
  AGENT: ['view_leads', 'change_status', 'add_note'],
  ADMIN: [
    'view_leads',
    'change_status',
    'add_note',
    'assign',
    'export',
    'record_disbursement',
    'lender_crud',
    'dashboard',
    'audit_view',
    'contact_inbox',
  ],
  SUPER_ADMIN: [
    'view_leads',
    'change_status',
    'add_note',
    'assign',
    'export',
    'record_disbursement',
    'lender_crud',
    'dashboard',
    'audit_view',
    'contact_inbox',
    'team_manage',
    'settings',
  ],
};

/** True if the role is granted the capability. */
export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

/** All capabilities granted to a role (e.g. to drive sidebar nav visibility). */
export function capabilitiesFor(role: Role): Capability[] {
  return MATRIX[role];
}
