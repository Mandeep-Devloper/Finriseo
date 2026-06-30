// Shared, client-safe labels for the audit action vocabulary (borrower + admin).
// Used by the lead detail activity trail, the dashboard recent-activity feed, and
// the Phase 5 audit-log viewer so they all read consistently.

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Borrower flow
  started: 'Application started',
  updated: 'Details updated',
  submitted: 'Submitted to Finriseo',
  // Admin actions
  login: 'Admin signed in',
  logout: 'Admin signed out',
  view_detail: 'Viewed details',
  status_change: 'Status changed',
  assign: 'Assignment changed',
  note_add: 'Note added',
  export: 'Exported leads',
  disbursement_record: 'Disbursement recorded',
  lender_create: 'Lender created',
  lender_update: 'Lender updated',
  lender_delete: 'Lender deleted',
  user_invite: 'Admin invited',
  user_update: 'Admin updated',
  user_deactivate: 'Admin deactivated',
  contact_resolve: 'Message resolved',
  settings_update: 'Settings updated',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
