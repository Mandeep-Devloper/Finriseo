// Edge-safe auth constants. Kept free of firebase-admin / server-only imports so
// they can be referenced from both Node route handlers and edge middleware.
export const SESSION_COOKIE = 'finriseo_session';

// Session lifetime: 1 hour. Long enough to complete the apply funnel in one
// sitting, short enough to limit the replay window for a PII/financial flow.
export const SESSION_TTL_MS = 60 * 60 * 1000;

// ── Admin session (god-mode panel) ──────────────────────────────────
// DELIBERATELY a separate cookie from the borrower SESSION_COOKIE so a borrower
// phone session can never be presented to an admin route and vice versa — the
// separation is structural, not just a role check. Both cookies are minted from
// Firebase session cookies, but admins authenticate with Email/Password (no
// phone_number claim) while borrowers authenticate with Phone OTP.
export const ADMIN_SESSION_COOKIE = 'finriseo_admin_session';

// Admin sessions are shorter-lived than the borrower funnel: this is god-mode
// access to every borrower's PII, so we cap the replay window tighter (30 min)
// and re-verify against the DB (active + role) on every request anyway.
export const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
