// Edge-safe auth constants. Kept free of firebase-admin / server-only imports so
// they can be referenced from both Node route handlers and edge middleware.
export const SESSION_COOKIE = 'finriseo_session';

// Session lifetime: 1 hour. Long enough to complete the apply funnel in one
// sitting, short enough to limit the replay window for a PII/financial flow.
export const SESSION_TTL_MS = 60 * 60 * 1000;
