// Admin lead pipeline — canonical status vocabulary. Application.status is a
// STRING column (see CLAUDE.md decision), so these are the agreed values; the
// admin UI + APIs validate against them. This module is client-safe (no db /
// server-only imports) so filter dropdowns and badges can import it.
//
// Borrower funnel writes: "draft" (in progress / abandoned) → "submitted" (final
// step done). The admin pipeline takes over from "submitted" onward.

export const DRAFT_STATUS = 'draft';

// Statuses an admin can move a lead through. The brief's "NEW" ≡ "submitted".
export const PIPELINE_STATUSES = [
  'submitted',
  'contacted',
  'docs_pending',
  'sent_to_lender',
  'approved',
  'disbursed',
  'rejected',
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

// All values that can appear in the column (pipeline + draft).
export const ALL_STATUSES = [DRAFT_STATUS, ...PIPELINE_STATUSES] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'New',
  contacted: 'Contacted',
  docs_pending: 'Docs Pending',
  sent_to_lender: 'Sent to Lender',
  approved: 'Approved',
  disbursed: 'Disbursed',
  rejected: 'Rejected',
};

// Badge tone key per status → maps to a CSS class in the table/detail styles.
export const STATUS_TONE: Record<string, string> = {
  draft: 'gray',
  submitted: 'blue',
  contacted: 'indigo',
  docs_pending: 'amber',
  sent_to_lender: 'purple',
  approved: 'green',
  disbursed: 'forest',
  rejected: 'red',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isPipelineStatus(value: string): value is PipelineStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}
