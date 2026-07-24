# Magic Resume — Resume Loan Application Design

**Date:** 2026-07-24
**Status:** Approved (design) — pending implementation plan
**Author:** Principal Architect (pairing session)

## 1. Problem

The apply funnel is `/apply` (name + mobile + OTP) → `basic-details` → `employment` →
`pan` → `offers` → `success`. Today, progress lives only in `sessionStorage`
(`finriseo_progress`), which is wiped when the tab closes, and the borrower session is
a **1-hour** Firebase session cookie (deliberately short for a PII/financial flow).

Consequences: a user who abandons and returns must re-enter mobile, receive **another
paid OTP**, and often re-enter data. This drives abandonment, OTP cost, and friction.

**Goal:** a returning user on the same trusted browser resumes within **7 days with no
OTP**, dropped at the exact step with all entered values intact; a user on a new
device re-verifies OTP once and is magically restored into their most-recent draft.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Same-browser resume authorization | **Trusted-browser session** (httpOnly 7-day server session, DB-backed, fingerprint-bound, sliding, revocable) authorizing **draft-scoped** read/write only |
| 2 | New-device restore after OTP | **Full magic restore** — route position + all entered fields (PAN excluded) |
| 3 | Expiry | **Sliding 7-day** window, hard cap at **30 days** from creation |
| 4 | Relationship to existing auth | **Layer on top** — keep the 1h Firebase session for strong auth; add the trusted layer; DB becomes source of truth, `sessionStorage` a cache |
| 5 | Submit under trusted session | **Allowed** — PAN is always freshly typed on the PAN step (never restored), eligibility re-derived server-side, ownership + rate limits still enforced |
| 6 | Migration | **Authored here, applied by the user** — do not run any DB command |

**Rejected alternatives:** fully normalizing into separate `users` /
`application_progress` / `draft_data` tables (resume must be a single-row read in a
serverless runtime; normalization adds joins for no benefit at this scale); replacing
the 1h Firebase session (higher blast radius on a security-reviewed flow). A borrower
`users` table is deferred — borrower identity stays `mobile` — and listed as a future
recommendation.

## 3. Architecture Overview

Two cooperating session concepts:

- **Firebase session cookie** (`finriseo_session`, 1h) — unchanged. Strong auth minted
  from a fresh OTP-verified ID token. Still the only thing that authorizes submitted
  records and remains a valid authorizer for draft ops.
- **Trusted-browser session** (`finriseo_trust`, 7d sliding) — new. A DB-backed,
  fingerprint-bound, revocable server session that authorizes **draft-scoped**
  operations for one browser without re-OTP, and lets the server *know* a browser has
  an unfinished draft (for the Resume UI and the Apply-Now decision).

Draft resume state is consolidated onto the existing `Application` row (single-row read)
plus the new `TrustedSession` table.

## 4. Database (Prisma migration — user applies)

### 4.1 Extend `Application`
```prisma
currentRoute   String?            // exact route to restore, e.g. "/apply/employment"
progressPct    Int      @default(0)
completedSteps String[] @default([])
draftData      Json?              // JSONB snapshot of NON-SENSITIVE funnel fields; PAN excluded
lastActivityAt DateTime @default(now())
expiresAt      DateTime?          // stale-draft purge horizon (e.g. now + 90d), for retention job
```
Add index `@@index([lastActivityAt])` to support "most recently active draft" lookups.

### 4.2 New `TrustedSession`
```prisma
model TrustedSession {
  id             String    @id @default(cuid())
  tokenHash      String    @unique   // SHA-256 of the raw token; raw token only in the cookie
  applicationId  String                // most-recent draft this browser owns
  mobile         String                // denormalized for fast owner checks
  fingerprint    String                // soft device-bind hash (UA + Accept-Language)
  ip             String?               // creation IP (audit only)
  userAgent      String?
  createdAt      DateTime  @default(now())
  lastUsedAt     DateTime  @default(now())
  expiresAt      DateTime              // sliding, now + 7d
  absoluteExpiry DateTime              // hard cap, createdAt + 30d
  revokedAt      DateTime?
  application    Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([mobile])
  @@index([expiresAt])
  @@index([applicationId])
}
```
`Application` gains the back-relation `trustedSessions TrustedSession[]`.

**Why hash the token:** a DB compromise must not yield usable session tokens. The raw
32-byte random token exists only inside the httpOnly cookie; the server hashes the
presented token and looks up by `tokenHash` (same principle as password hashing).

## 5. Session / Auth Layer

### 5.1 `src/lib/auth/constants.ts` (extend)
```
TRUSTED_COOKIE = 'finriseo_trust'
TRUSTED_TTL_MS = 7 * 24 * 60 * 60 * 1000   // sliding window
TRUSTED_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000  // hard cap
```

### 5.2 `src/lib/auth/fingerprint.ts` (new)
`computeFingerprint(headers) -> string` = SHA-256 of `User-Agent` + `Accept-Language`.
Privacy-friendly: only headers already sent on every request; no canvas/font/GPU
tracking. Used as a **soft** bind.

### 5.3 `src/lib/auth/trustedSession.ts` (new, `server-only`)
- `createTrustedSession(applicationId, mobile, headers) -> Promise<void>`
  32-byte `crypto.randomBytes` token → store `tokenHash`, `fingerprint`, `expiresAt`,
  `absoluteExpiry` → set `finriseo_trust` cookie (httpOnly, Secure in prod,
  SameSite=Lax, path=/, maxAge=7d). Revokes/replaces any prior session for the browser.
- `getTrustedSession(headers) -> Promise<{ applicationId, mobile } | null>`
  Read cookie → hash → lookup by `tokenHash` → reject if `revokedAt`, expired
  (`expiresAt < now` or `absoluteExpiry < now`). **Soft fingerprint check:** on
  mismatch, return `null` (caller falls back to OTP) — never auto-restore PII to a
  changed fingerprint. On success, **slide**: `lastUsedAt = now`,
  `expiresAt = min(now + 7d, absoluteExpiry)`.
- `revokeTrustedSession(headers)` — mark `revokedAt`, clear cookie. Used on explicit
  "start new application".

### 5.4 `src/lib/auth/session.ts` (extend)
```ts
requireDraftAccess(headers, referenceId) -> { mobile, via: 'firebase' | 'trusted' }
```
Accepts **either**:
- a valid Firebase session whose phone owns the row, **or**
- a valid trusted session whose `applicationId` maps to the row's `referenceId` and
  whose `mobile` matches,

and **only** when the target row is `status='draft'`. Returns `mobile` + which path
authorized. Throws `SessionError` otherwise. Submitted/admin paths keep the existing
`requireSession` / `requireAdmin`.

## 6. Resume + Restore Flows

### 6.1 Same browser — homepage
`ResumeJourneyCard` (client) fetches `GET /api/application/resume`:
- Server reads trusted cookie, validates, returns **progress only**:
  `{ hasDraft, progressPct, currentRoute, currentStep, lastActivityAt, estRemainingMin, referenceId }`.
- **No PII** in this payload. Homepage remains statically cached; the card hydrates
  progressively. If `hasDraft` is false, the normal Hero form renders.

### 6.2 Same browser — `/apply`
Server component reads the trusted cookie. If a valid draft exists → route to
`currentRoute`; the funnel hydrates the Zustand store from `GET /api/application/draft`
(non-sensitive fields, **PAN excluded**, authorized by trusted **or** Firebase session).

### 6.3 New device / incognito / cleared / expired
Standard OTP. On `otp/verify` success, the server looks up the **most recently active**
unfinished draft (`status='draft'`, order by `lastActivityAt desc`) for the verified
mobile. If found → mint a fresh trusted session bound to it, and the client performs
**full magic restore** (route + all non-PAN fields) into the funnel at the exact step.
If multiple drafts exist, the most-recently-active one wins; others are left untouched.

### 6.3.1 Middleware
[middleware.ts](../../../src/middleware.ts) currently bounces any visitor lacking
`finriseo_session` from the apply steps back to `/apply`. It will be updated to also
treat presence of the `finriseo_trust` cookie as sufficient to reach the apply steps
(presence check only — real validation stays in the Node route handlers), so a resuming
user whose 1h Firebase session has lapsed lands on their step instead of taking an extra
redirect through `/apply`.

### 6.4 Duplicate prevention
`start` remains idempotent on `referenceId`. When a trusted session already points to a
live draft, `/apply` resumes it instead of creating a new row. "Start new" explicitly
revokes the trusted session first.

## 7. New / Changed API

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/application/resume` | GET | trusted (progress only) | Resume-card summary, no PII |
| `/api/application/draft` | GET | `requireDraftAccess` | Full non-sensitive draft for store hydration (PAN excluded) |
| `/api/application/start` | POST | + creates trusted session | Existing; also mints trusted session on draft create |
| `/api/application/[referenceId]` | PATCH | `requireDraftAccess` | Existing; now also persists resume fields + `draftData` merge |
| `/api/application/submit` | POST | `requireDraftAccess` (draft) | Existing; trusted session may authorize; revokes trusted session on success |
| `/api/otp/verify` | POST | — | Existing; on success, resume-lookup by mobile + mint trusted session |

## 8. Autosave

`src/hooks/useAutosave.ts`: debounced PATCH on **field blur**, on **Next**, and on step
completion. Each PATCH also writes `currentStep`, `currentRoute`, `progressPct`,
`completedSteps`, `lastActivityAt`, and merges the `draftData` snapshot. Extends the
PATCH route + `applicationPatchSchema`. `sessionStorage` stays as a fast client cache;
**the DB row is the source of truth** for restore.

## 9. Shared Progress Utility

`src/lib/application/progress.ts`: single source of truth —
`STEPS` (order, route, label, weight), `computeProgressPct(completedSteps)`,
`estRemainingMinutes(currentStep)`, `motivationalMessage(progressPct)`. Consumed by
`ApplyLayout`, `ResumeJourneyCard`, and the resume API so displayed numbers never
disagree.

## 10. UI

`src/components/sections/ResumeJourney/ResumeJourneyCard.tsx` (+ `.module.css`):
Framer Motion animated progress fill, `NN% Completed`, estimated remaining time,
relative last-activity ("Yesterday"), motivational line ("Just two steps remaining…"),
**Continue Application** → `currentRoute`. Built on existing gold/green design tokens
and CSS-module conventions — no new design language. Rendered in the Hero slot on the
homepage when `hasDraft`.

## 11. Security

- 32-byte random token; **only its SHA-256 hash** stored; raw token only in the cookie.
- Cookie: httpOnly, Secure (prod), SameSite=Lax, path=/.
- **Soft fingerprint** (UA + Accept-Language) → mismatch downgrades to OTP, never
  auto-restores PII.
- **Sliding** 7-day expiry, **absolute** 30-day cap; revocable via `revokedAt`.
- **Draft-scoped only** — never authorizes submitted records or admin routes.
- `draftData` excludes PAN; PAN remains encrypt-at-rest via `encryptPii`, re-typed each
  session, never in `sessionStorage` or restore payloads.
- No internal IDs exposed; public handle stays `referenceId`.
- Existing per-phone/per-IP rate limits reused on start/patch/submit/verify.
- **Threats covered:** hijack (hashed token + fingerprint + httpOnly), replay (fresh
  fingerprint + sliding expiry + revocation), duplicate applications (idempotent start +
  resume-most-recent), tampering (server-side eligibility re-derivation on submit),
  expired usage (dual expiry checks).

## 12. Performance

- Resume = **single indexed row read** (`Application`) + one `TrustedSession` lookup.
- Homepage stays statically cached; resume card is a progressive client fetch.
- Autosave PATCH is debounced and fire-and-forget (never blocks navigation).
- Small payloads: resume summary is progress-only; draft payload excludes PAN and
  admin fields.
- New indexes: `TrustedSession(mobile, expiresAt, applicationId)`,
  `Application(lastActivityAt)`.

## 13. Testing

**Vitest units:** `trustedSession` (create / validate / expire / slide / revoke /
fingerprint-mismatch → null), `progress` util (pct, est time, message), `requireDraftAccess`
(accepts firebase, accepts trusted, rejects cross-owner, rejects non-draft).

**Manual scenario matrix:** First visit · Browser refresh · Browser closed · Session
resume · Session expired · Cookies deleted · Incognito · New browser · New device · OTP
after expiry · Resume after OTP · Multiple drafts · Duplicate prevention · Invalid
session · Server restart · Autosave recovery.

## 14. Future Recommendations

- Introduce a borrower `users` table if borrower accounts/login are ever needed.
- Scheduled purge job (cron route already exists) for stale drafts (`expiresAt`) and
  expired `TrustedSession` rows.
- Optional: bind trusted session to a rotating token (rotate `tokenHash` on each use)
  for defence against long-lived cookie theft.
- Optional WebAuthn/passkey upgrade path for true device trust.

## 15. Files

**Created:** `trustedSession.ts`, `fingerprint.ts`, `progress.ts`,
`api/application/resume/route.ts`, `api/application/draft/route.ts`,
`ResumeJourney/ResumeJourneyCard.tsx` (+ css), `hooks/useAutosave.ts`,
`hooks/useResumeApplication.ts`, unit tests, 1 Prisma migration.

**Modified:** `schema.prisma`, `auth/constants.ts`, `auth/session.ts`, `otp/verify`,
`application/start`, `application/[referenceId]`, `application/submit`,
`store/applicationStore.ts`, `ApplyLayout` + Hero wiring, `lib/validations`,
`middleware.ts`.
