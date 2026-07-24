# Magic Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a borrower resume an unfinished loan application with no OTP on the same trusted browser within 7 days, and magically restore their most-recent draft after a single OTP on any new device.

**Architecture:** Add a DB-backed, fingerprint-bound, sliding 7-day **trusted-browser session** (`finriseo_trust` cookie, hashed token) that authorizes **draft-scoped** operations alongside the existing 1h Firebase session. Consolidate resume state (route, progress, `draftData` JSONB) onto the `Application` row so resume is a single indexed read. Homepage shows a progress-only Resume card; `/apply` and post-OTP flows restore the draft into the Zustand store.

**Tech Stack:** Next.js 15 (App Router, Node route handlers + edge middleware) · Prisma 6 over Supabase Postgres · Firebase Phone Auth / firebase-admin · Zustand · React Hook Form + Zod · Framer Motion · Vitest · `node:crypto`.

## Global Constraints

- **Strict TypeScript, no `any`** — matches the repo's existing style.
- **PAN is never** placed in `draftData`, `sessionStorage`, resume payloads, or logs. It is written only via `encryptPii` and re-typed each session.
- **Trusted session is draft-scoped only** — it must never authorize a `status != 'draft'` row, submitted records, or any admin route.
- **Token at rest is a SHA-256 hash**; the raw 32-byte token exists only inside the httpOnly cookie.
- **Cookie attributes:** httpOnly, `secure` in production only (`process.env.NODE_ENV === 'production'`), `SameSite=Lax`, `path=/`.
- **Migration is authored here, applied by the user.** Do not run `prisma migrate` against any DB. `prisma generate` (no DB needed) is fine.
- **Borrower identity stays `mobile`.** No `users` table.
- New code follows existing patterns: `db` from `@/lib/db`, IP via `getClientIp(headers)` from `@/lib/http/ip`, rate-limit helpers from `@/app/api/otp/_otpStore`, audit via `recordAudit`, tests colocated as `*.test.ts` using Vitest with `vi.mock('@/lib/db', …)`.
- Commit after every task with a `feat:`/`test:`/`chore:` message.

---

## File Structure

**Created:**
- `prisma/migrations/20260724000000_magic_resume/migration.sql` — schema migration (user applies)
- `src/lib/application/progress.ts` — step model + progress/ETA/message helpers
- `src/lib/application/progress.test.ts`
- `src/lib/auth/fingerprint.ts` — soft device fingerprint
- `src/lib/auth/fingerprint.test.ts`
- `src/lib/auth/trustedSession.ts` — create/validate/slide/revoke trusted session
- `src/lib/auth/trustedSession.test.ts`
- `src/app/api/application/resume/route.ts` — progress-only summary (GET)
- `src/app/api/application/draft/route.ts` — non-sensitive draft for hydration (GET)
- `src/hooks/useAutosave.ts` — debounced draft autosave
- `src/hooks/useResumeApplication.ts` — restore store from server draft
- `src/components/sections/ResumeJourney/ResumeJourneyCard.tsx` (+ `.module.css`)
- `src/components/sections/ResumeJourney/index.ts`

**Modified:**
- `prisma/schema.prisma` — extend `Application`, add `TrustedSession`
- `src/lib/auth/constants.ts` — trusted-session constants
- `src/lib/auth/session.ts` — `requireDraftAccess`
- `src/lib/auth/session.test.ts` (new colocated test for the new function)
- `src/lib/validations.ts` — resume fields on `applicationPatchSchema`
- `src/app/api/application/[referenceId]/route.ts` — persist resume fields + `draftData`
- `src/app/api/application/start/route.ts` — mint trusted session on draft create/resume
- `src/app/api/application/submit/route.ts` — `requireDraftAccess` + revoke trusted session
- `src/app/api/otp/verify/route.ts` — resume-lookup + mint trusted session
- `src/middleware.ts` — accept `finriseo_trust` presence for apply steps
- `src/store/applicationStore.ts` — `hydrateFromServer` action
- `src/components/sections/Hero/Hero.tsx` — render Resume card when a draft exists
- funnel step pages (`basic-details`, `employment`, `pan`) — wire `useAutosave`

---

## Task 1: Database schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260724000000_magic_resume/migration.sql`

**Interfaces:**
- Produces: `Application.currentRoute/progressPct/completedSteps/draftData/lastActivityAt/expiresAt`; model `TrustedSession` with fields `id, tokenHash, applicationId, mobile, fingerprint, ip, userAgent, createdAt, lastUsedAt, expiresAt, absoluteExpiry, revokedAt`.

- [ ] **Step 1: Extend `Application` in `prisma/schema.prisma`**

Add these fields to the `Application` model (after `updatedAt`, before the relations block):

```prisma
  // ── Magic Resume (draft resume state; single-row read) ──
  currentRoute   String?            // exact route to restore, e.g. "/apply/employment"
  progressPct    Int      @default(0)
  completedSteps String[] @default([])
  // JSONB snapshot of NON-SENSITIVE funnel fields for full restore. PAN is
  // NEVER written here (see Global Constraints).
  draftData      Json?
  lastActivityAt DateTime @default(now())
  // Stale-draft purge horizon for the retention job; nullable for old rows.
  expiresAt      DateTime?
```

Add to the same model's relations block:

```prisma
  trustedSessions TrustedSession[]
```

Add one index to the `Application` `@@index` block:

```prisma
  @@index([lastActivityAt])
```

- [ ] **Step 2: Add the `TrustedSession` model** (place after the `Application`/`Note` models)

```prisma
// Trusted-browser session for Magic Resume. DB-backed so it is revocable and
// server-visible. The raw 32-byte token lives ONLY in the httpOnly finriseo_trust
// cookie; here we store only its SHA-256 hash (a DB leak can't be replayed).
// Authorizes DRAFT-scoped operations for one browser for 7 days (sliding, capped
// at 30 days). NEVER authorizes submitted records or admin routes.
model TrustedSession {
  id             String    @id @default(cuid())
  tokenHash      String    @unique
  applicationId  String
  mobile         String
  fingerprint    String    // soft device bind: hash(UA + Accept-Language)
  ip             String?
  userAgent      String?
  createdAt      DateTime  @default(now())
  lastUsedAt     DateTime  @default(now())
  expiresAt      DateTime  // sliding: now + 7d, capped at absoluteExpiry
  absoluteExpiry DateTime  // hard cap: createdAt + 30d
  revokedAt      DateTime?

  application Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([mobile])
  @@index([expiresAt])
  @@index([applicationId])
}
```

- [ ] **Step 3: Author the migration SQL** (do NOT run it)

Create `prisma/migrations/20260724000000_magic_resume/migration.sql`:

```sql
-- Extend Application with Magic Resume columns
ALTER TABLE "Application" ADD COLUMN "currentRoute" TEXT;
ALTER TABLE "Application" ADD COLUMN "progressPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN "completedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Application" ADD COLUMN "draftData" JSONB;
ALTER TABLE "Application" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Application" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "Application_lastActivityAt_idx" ON "Application"("lastActivityAt");

-- TrustedSession
CREATE TABLE "TrustedSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiry" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "TrustedSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustedSession_tokenHash_key" ON "TrustedSession"("tokenHash");
CREATE INDEX "TrustedSession_mobile_idx" ON "TrustedSession"("mobile");
CREATE INDEX "TrustedSession_expiresAt_idx" ON "TrustedSession"("expiresAt");
CREATE INDEX "TrustedSession_applicationId_idx" ON "TrustedSession"("applicationId");

ALTER TABLE "TrustedSession" ADD CONSTRAINT "TrustedSession_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the Prisma client** (no DB needed)

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success; new fields/model appear in types.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet, so schema change alone must not break types).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260724000000_magic_resume/migration.sql
git commit -m "feat(db): add TrustedSession + Application resume columns for Magic Resume"
```

> **Handoff note for the user:** apply with `npx prisma migrate deploy` (or `prisma migrate dev`) against Supabase when ready. Implementation/tests below mock the DB and do not require the migration to be applied.

---

## Task 2: Progress utility

**Files:**
- Create: `src/lib/application/progress.ts`
- Test: `src/lib/application/progress.test.ts`

**Interfaces:**
- Produces:
  - `STEPS: readonly StepDef[]` where `StepDef = { key: string; route: string; label: string }`
  - `STEP_KEYS: readonly string[]`
  - `computeProgressPct(completedSteps: string[]): number`
  - `estRemainingMinutes(currentStepKey: string): number`
  - `motivationalMessage(progressPct: number): string`
  - `routeForStep(stepKey: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/application/progress.test.ts
import { describe, it, expect } from 'vitest';
import {
  STEPS,
  computeProgressPct,
  estRemainingMinutes,
  motivationalMessage,
  routeForStep,
} from './progress';

describe('progress util', () => {
  it('has the six funnel steps in order', () => {
    expect(STEPS.map((s) => s.key)).toEqual([
      'otp_verified', 'basic_details', 'employment', 'pan_verified', 'offers', 'submitted',
    ]);
  });

  it('computes 0% for no completed steps', () => {
    expect(computeProgressPct([])).toBe(0);
  });

  it('computes rounded percentage from completed steps', () => {
    // 3 of 6 completed -> 50
    expect(computeProgressPct(['otp_verified', 'basic_details', 'employment'])).toBe(50);
  });

  it('ignores unknown/duplicate step keys when computing percent', () => {
    expect(computeProgressPct(['otp_verified', 'otp_verified', 'bogus'])).toBe(17);
  });

  it('caps at 100%', () => {
    expect(computeProgressPct(STEPS.map((s) => s.key))).toBe(100);
  });

  it('estimates fewer remaining minutes further along', () => {
    const early = estRemainingMinutes('basic_details');
    const late = estRemainingMinutes('offers');
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThanOrEqual(0);
  });

  it('returns a friendly message keyed to progress', () => {
    expect(motivationalMessage(10)).toMatch(/./);
    expect(motivationalMessage(90)).toMatch(/almost/i);
  });

  it('maps a step key to its route', () => {
    expect(routeForStep('employment')).toBe('/apply/employment');
    expect(routeForStep('otp_verified')).toBe('/apply/basic-details');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/application/progress.test.ts`
Expected: FAIL — cannot find module `./progress`.

- [ ] **Step 3: Implement `src/lib/application/progress.ts`**

```ts
// Single source of truth for funnel steps, progress %, ETA, and copy. Reused by
// ApplyLayout, ResumeJourneyCard, and the resume API so numbers never disagree.

export interface StepDef {
  /** Persisted `currentStep` value on the Application row. */
  key: string;
  /** Route the borrower is ON while this step's key is current (for resume). */
  route: string;
  label: string;
}

// `key` matches Application.currentStep values. `route` is where to send the user
// to CONTINUE from that step (i.e. the next screen to fill), so otp_verified ->
// the basic-details screen. `submitted` resolves to the success page.
export const STEPS: readonly StepDef[] = [
  { key: 'otp_verified',  route: '/apply/basic-details', label: 'Basic Info' },
  { key: 'basic_details', route: '/apply/employment',    label: 'Details' },
  { key: 'employment',    route: '/apply/pan',           label: 'Employment' },
  { key: 'pan_verified',  route: '/apply/offers',        label: 'PAN' },
  { key: 'offers',        route: '/apply/success',       label: 'Offers' },
  { key: 'submitted',     route: '/apply/success',       label: 'Done' },
] as const;

export const STEP_KEYS: readonly string[] = STEPS.map((s) => s.key);

/** Percentage of the funnel completed, 0–100, rounded. */
export function computeProgressPct(completedSteps: string[]): number {
  const valid = new Set(completedSteps.filter((s) => STEP_KEYS.includes(s)));
  const pct = (valid.size / STEPS.length) * 100;
  return Math.min(100, Math.round(pct));
}

// Rough per-remaining-step estimate (minutes). The funnel is short, so ~0.5 min
// per remaining screen, floored at 1 when anything remains, 0 when done.
export function estRemainingMinutes(currentStepKey: string): number {
  const idx = STEP_KEYS.indexOf(currentStepKey);
  const doneIdx = idx === -1 ? 0 : idx + 1;
  const remaining = Math.max(0, STEPS.length - doneIdx);
  if (remaining === 0) return 0;
  return Math.max(1, Math.round(remaining * 0.5));
}

export function motivationalMessage(progressPct: number): string {
  if (progressPct >= 80) return "You're almost there — just one step to unlock your offers.";
  if (progressPct >= 50) return 'Halfway done — a couple of steps to personalized loan offers.';
  if (progressPct >= 25) return 'Great start — pick up right where you left off.';
  return 'Complete your application to unlock personalized loan offers.';
}

export function routeForStep(stepKey: string): string {
  return STEPS.find((s) => s.key === stepKey)?.route ?? '/apply/basic-details';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/application/progress.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/application/progress.ts src/lib/application/progress.test.ts
git commit -m "feat(resume): shared funnel progress/ETA/message utility"
```

---

## Task 3: Fingerprint utility

**Files:**
- Create: `src/lib/auth/fingerprint.ts`
- Test: `src/lib/auth/fingerprint.test.ts`

**Interfaces:**
- Consumes: `HeaderGetter` from `@/lib/http/ip`.
- Produces: `computeFingerprint(headers: HeaderGetter): string` (hex SHA-256).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/fingerprint.test.ts
import { describe, it, expect } from 'vitest';
import { computeFingerprint } from './fingerprint';

function headers(map: Record<string, string>) {
  return { get: (k: string) => map[k.toLowerCase()] ?? null };
}

describe('computeFingerprint', () => {
  it('is stable for the same UA + Accept-Language', () => {
    const h = headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' });
    expect(computeFingerprint(h)).toBe(computeFingerprint(h));
  });

  it('is a 64-char hex string', () => {
    const fp = computeFingerprint(headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' }));
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when the user agent changes', () => {
    const a = computeFingerprint(headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' }));
    const b = computeFingerprint(headers({ 'user-agent': 'UA/2', 'accept-language': 'en-IN' }));
    expect(a).not.toBe(b);
  });

  it('handles missing headers deterministically', () => {
    expect(computeFingerprint(headers({}))).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/fingerprint.test.ts`
Expected: FAIL — cannot find module `./fingerprint`.

- [ ] **Step 3: Implement `src/lib/auth/fingerprint.ts`**

```ts
import { createHash } from 'node:crypto';
import type { HeaderGetter } from '@/lib/http/ip';

// Privacy-friendly SOFT device fingerprint: hashes ONLY headers the browser
// already sends on every request (User-Agent + Accept-Language). No canvas, font,
// or GPU probing. Used as a soft bind — a mismatch downgrades a returning user to
// OTP rather than exposing their draft PII to a changed device signature.
export function computeFingerprint(headers: HeaderGetter): string {
  const ua = headers.get('user-agent') ?? '';
  const lang = headers.get('accept-language') ?? '';
  return createHash('sha256').update(`${ua}\n${lang}`).digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/fingerprint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/fingerprint.ts src/lib/auth/fingerprint.test.ts
git commit -m "feat(auth): soft privacy-friendly device fingerprint"
```

---

## Task 4: Trusted-session constants + library

**Files:**
- Modify: `src/lib/auth/constants.ts`
- Create: `src/lib/auth/trustedSession.ts`
- Test: `src/lib/auth/trustedSession.test.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; `computeFingerprint` from `./fingerprint`; `cookies()` from `next/headers`; `HeaderGetter` from `@/lib/http/ip`.
- Produces:
  - Constants `TRUSTED_COOKIE`, `TRUSTED_TTL_MS`, `TRUSTED_ABSOLUTE_TTL_MS`.
  - `hashToken(raw: string): string`
  - `createTrustedSession(args: { applicationId: string; mobile: string; headers: HeaderGetter; ip?: string | null }): Promise<void>`
  - `getTrustedSession(headers: HeaderGetter): Promise<{ applicationId: string; mobile: string } | null>`
  - `revokeTrustedSession(): Promise<void>`

- [ ] **Step 1: Add constants to `src/lib/auth/constants.ts`** (append)

```ts
// ── Trusted-browser session (Magic Resume) ──────────────────────────
// A DB-backed, fingerprint-bound session that lets a returning borrower resume a
// DRAFT with no OTP. Separate from SESSION_COOKIE: it authorizes draft-scoped ops
// only, never submitted records or admin routes.
export const TRUSTED_COOKIE = 'finriseo_trust';
// Sliding window reset on each activity.
export const TRUSTED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Hard cap from creation — a session can never live past this regardless of use.
export const TRUSTED_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: Write the failing test** (mock `@/lib/db` and `next/headers`)

```ts
// src/lib/auth/trustedSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
const cookieJar = {
  get: (k: string) => (store.has(k) ? { value: store.get(k)! } : undefined),
  set: (k: string, v: string) => { store.set(k, v); },
  delete: (k: string) => { store.delete(k); },
};
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieJar) }));

vi.mock('@/lib/db', () => ({
  db: {
    trustedSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { db } from '@/lib/db';
import {
  hashToken,
  createTrustedSession,
  getTrustedSession,
  revokeTrustedSession,
} from './trustedSession';

const headers = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null });
const H = headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('trustedSession', () => {
  it('hashToken is a stable 64-char hex hash', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('createTrustedSession stores a hashed token and sets the cookie', async () => {
    await createTrustedSession({ applicationId: 'app1', mobile: '9876543210', headers: H, ip: '1.1.1.1' });
    expect(store.has('finriseo_trust')).toBe(true);
    const raw = store.get('finriseo_trust')!;
    const createArg = vi.mocked(db.trustedSession.create).mock.calls[0][0].data;
    expect(createArg.tokenHash).toBe(hashToken(raw));       // hash stored, not raw
    expect(createArg.tokenHash).not.toBe(raw);
    expect(createArg.applicationId).toBe('app1');
    expect(createArg.mobile).toBe('9876543210');
  });

  it('getTrustedSession returns owner for a valid, matching-fingerprint session', async () => {
    await createTrustedSession({ applicationId: 'app1', mobile: '9876543210', headers: H });
    const raw = store.get('finriseo_trust')!;
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken(raw), applicationId: 'app1', mobile: '9876543210',
      fingerprint: (await import('./fingerprint')).computeFingerprint(H),
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    const res = await getTrustedSession(H);
    expect(res).toEqual({ applicationId: 'app1', mobile: '9876543210' });
    expect(db.trustedSession.update).toHaveBeenCalled(); // slide
  });

  it('getTrustedSession returns null when expired', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: (await import('./fingerprint')).computeFingerprint(H),
      expiresAt: new Date(Date.now() - 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null when revoked', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: (await import('./fingerprint')).computeFingerprint(H),
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: new Date(),
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null on fingerprint mismatch (downgrade to OTP)', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: 'a-totally-different-fingerprint',
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null when no cookie present', async () => {
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('revokeTrustedSession clears the cookie and marks the row revoked', async () => {
    store.set('finriseo_trust', 'rawtoken');
    await revokeTrustedSession();
    expect(store.has('finriseo_trust')).toBe(false);
    expect(db.trustedSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('rawtoken'), revokedAt: null } })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/trustedSession.test.ts`
Expected: FAIL — cannot find module `./trustedSession`.

- [ ] **Step 4: Implement `src/lib/auth/trustedSession.ts`**

```ts
import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { computeFingerprint } from './fingerprint';
import type { HeaderGetter } from '@/lib/http/ip';
import { TRUSTED_COOKIE, TRUSTED_TTL_MS, TRUSTED_ABSOLUTE_TTL_MS } from './constants';

/** SHA-256 hex of a raw token. Only the hash is ever stored. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function trustedCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/**
 * Mint a fresh trusted session for one browser + draft. Revokes any prior live
 * session tied to the same browser's cookie is unnecessary here (a new cookie
 * replaces the old one); instead we revoke prior sessions for this application so
 * a browser can't accumulate live sessions for the same draft.
 */
export async function createTrustedSession(args: {
  applicationId: string;
  mobile: string;
  headers: HeaderGetter;
  ip?: string | null;
}): Promise<void> {
  const { applicationId, mobile, headers, ip } = args;
  const raw = randomBytes(32).toString('base64url');
  const now = Date.now();

  // Retire earlier live sessions for this draft (defence against pile-up).
  await db.trustedSession.updateMany({
    where: { applicationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await db.trustedSession.create({
    data: {
      tokenHash: hashToken(raw),
      applicationId,
      mobile,
      fingerprint: computeFingerprint(headers),
      ip: ip ?? null,
      userAgent: (headers.get('user-agent') ?? '').slice(0, 500),
      expiresAt: new Date(now + TRUSTED_TTL_MS),
      absoluteExpiry: new Date(now + TRUSTED_ABSOLUTE_TTL_MS),
    },
  });

  (await cookies()).set(TRUSTED_COOKIE, raw, trustedCookieOptions(TRUSTED_TTL_MS));
}

/**
 * Validate the trusted cookie and, on success, SLIDE its expiry. Returns the
 * draft owner, or null (caller falls back to OTP) when there is no cookie, the
 * row is missing/expired/revoked, or the fingerprint no longer matches.
 */
export async function getTrustedSession(
  headers: HeaderGetter
): Promise<{ applicationId: string; mobile: string } | null> {
  const raw = (await cookies()).get(TRUSTED_COOKIE)?.value;
  if (!raw) return null;

  const row = await db.trustedSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row) return null;

  const now = Date.now();
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < now) return null;
  if (row.absoluteExpiry.getTime() < now) return null;
  if (row.fingerprint !== computeFingerprint(headers)) return null; // soft bind → OTP

  // Slide: extend the window, never past the absolute cap.
  const nextExpiry = Math.min(now + TRUSTED_TTL_MS, row.absoluteExpiry.getTime());
  await db.trustedSession.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date(now), expiresAt: new Date(nextExpiry) },
  });

  return { applicationId: row.applicationId, mobile: row.mobile };
}

/** Revoke the current browser's trusted session and clear its cookie. */
export async function revokeTrustedSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(TRUSTED_COOKIE)?.value;
  if (raw) {
    await db.trustedSession.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(TRUSTED_COOKIE);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/trustedSession.test.ts`
Expected: PASS (all 9 cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/constants.ts src/lib/auth/trustedSession.ts src/lib/auth/trustedSession.test.ts
git commit -m "feat(auth): DB-backed trusted-browser session (hashed token, sliding, fingerprint bind)"
```

---

## Task 5: `requireDraftAccess` authorizer

**Files:**
- Modify: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts` (create)

**Interfaces:**
- Consumes: `getSession` (existing), `getTrustedSession` (Task 4), `db`.
- Produces: `requireDraftAccess(headers: HeaderGetter, referenceId: string): Promise<{ mobile: string; uid?: string; via: 'firebase' | 'trusted' }>` — throws `SessionError` when neither path authorizes a `status='draft'` row owned by the caller.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: { application: { findUnique: vi.fn() } },
}));
vi.mock('./trustedSession', () => ({ getTrustedSession: vi.fn() }));
// getSession reads cookies + firebase-admin; stub the whole module's getSession.
vi.mock('firebase-admin', () => ({}));

import { db } from '@/lib/db';
import { getTrustedSession } from './trustedSession';
import { requireDraftAccess, SessionError } from './session';
import * as sessionMod from './session';

const H = { get: (_k: string) => null };

beforeEach(() => vi.clearAllMocks());

describe('requireDraftAccess', () => {
  it('authorizes via a matching Firebase session on a draft row', async () => {
    vi.spyOn(sessionMod, 'getSession').mockResolvedValue({ uid: 'u1', phone: '9876543210' });
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    const res = await requireDraftAccess(H, 'FINABC123');
    expect(res).toMatchObject({ mobile: '9876543210', via: 'firebase' });
  });

  it('authorizes via a matching trusted session on a draft row', async () => {
    vi.spyOn(sessionMod, 'getSession').mockResolvedValue(null);
    vi.mocked(getTrustedSession).mockResolvedValue({ applicationId: 'app1', mobile: '9876543210' });
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    const res = await requireDraftAccess(H, 'FINABC123');
    expect(res).toMatchObject({ mobile: '9876543210', via: 'trusted' });
  });

  it('rejects a trusted session pointing at a different application', async () => {
    vi.spyOn(sessionMod, 'getSession').mockResolvedValue(null);
    vi.mocked(getTrustedSession).mockResolvedValue({ applicationId: 'OTHER', mobile: '9876543210' });
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });

  it('rejects when the row is not a draft (already submitted)', async () => {
    vi.spyOn(sessionMod, 'getSession').mockResolvedValue({ uid: 'u1', phone: '9876543210' });
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'submitted',
    } as never);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });

  it('rejects when neither session authorizes', async () => {
    vi.spyOn(sessionMod, 'getSession').mockResolvedValue(null);
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: FAIL — `requireDraftAccess` is not exported.

- [ ] **Step 3: Implement `requireDraftAccess` in `src/lib/auth/session.ts`**

Add imports at the top (below existing imports):

```ts
import { db } from '@/lib/db';
import { getTrustedSession } from './trustedSession';
import type { HeaderGetter } from '@/lib/http/ip';
```

Append this function:

```ts
export interface DraftAccess {
  /** Verified owner mobile (10-digit). */
  mobile: string;
  /** Firebase uid when authorized via the Firebase session. */
  uid?: string;
  via: 'firebase' | 'trusted';
}

/**
 * Authorize a DRAFT-scoped operation on the application identified by
 * `referenceId`. Accepts EITHER a valid Firebase session whose phone owns the
 * row, OR a valid trusted-browser session whose applicationId maps to the row and
 * whose mobile matches. Only rows with status='draft' are eligible — this is the
 * hard boundary that keeps the 7-day trusted cookie away from submitted records.
 * Throws SessionError otherwise.
 */
export async function requireDraftAccess(
  headers: HeaderGetter,
  referenceId: string
): Promise<DraftAccess> {
  const row = await db.application.findUnique({
    where: { referenceId },
    select: { id: true, mobile: true, status: true },
  });
  if (!row || row.status !== 'draft') throw new SessionError();

  // Path 1: Firebase session (strong, 1h).
  const fb = await getSession();
  if (fb && fb.phone === row.mobile) {
    return { mobile: row.mobile, uid: fb.uid, via: 'firebase' };
  }

  // Path 2: trusted-browser session (7d, draft-scoped).
  const trusted = await getTrustedSession(headers);
  if (trusted && trusted.mobile === row.mobile && trusted.applicationId === row.id) {
    return { mobile: row.mobile, via: 'trusted' };
  }

  throw new SessionError();
}
```

> **Note:** the test spies on `getSession` via the module namespace. Ensure `getSession` remains a named `export function` (it already is) so the spy resolves. `requireDraftAccess` calls the local `getSession` reference — this is intentional and the spy targets the same binding under Vitest's ESM interop.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: PASS (5 cases). If the `getSession` spy does not intercept, refactor `requireDraftAccess` to call `sessionModuleGetSession()` via `export const getSessionRef = { getSession }` — but first try as written.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): requireDraftAccess accepts Firebase or trusted session for draft-scoped ops"
```

---

## Task 6: Resume fields on the PATCH schema

**Files:**
- Modify: `src/lib/validations.ts`

**Interfaces:**
- Produces: `applicationPatchSchema` additionally accepts `currentRoute?`, `progressPct?`, `completedSteps?`, `draftData?`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validations.resume.test.ts
import { describe, it, expect } from 'vitest';
import { applicationPatchSchema } from './validations';

describe('applicationPatchSchema resume fields', () => {
  it('accepts resume fields', () => {
    const r = applicationPatchSchema.safeParse({
      currentStep: 'employment',
      currentRoute: '/apply/pan',
      progressPct: 50,
      completedSteps: ['otp_verified', 'basic_details', 'employment'],
      draftData: { loanAmount: 200000, email: 'a@b.com' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects a progressPct out of range', () => {
    expect(applicationPatchSchema.safeParse({ progressPct: 250 }).success).toBe(false);
  });

  it('still accepts a bare field update', () => {
    expect(applicationPatchSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations.resume.test.ts`
Expected: FAIL — `currentRoute` etc. stripped/invalid (unknown keys are ignored by Zod objects, so the first assertion passes but `progressPct: 250` succeeds → the range test FAILS).

- [ ] **Step 3: Add resume fields to `applicationPatchSchema`**

Insert before the closing `});` of `applicationPatchSchema`:

```ts
  // ── Magic Resume progress fields (progressive save) ──
  currentRoute: z.string().max(120).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  completedSteps: z.array(z.string().max(50)).max(20).optional(),
  // Non-sensitive funnel snapshot for full restore. PAN is never included by the
  // client; the route additionally strips it defensively (Task 7).
  draftData: z.record(z.string(), z.unknown()).optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations.resume.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/validations.resume.test.ts
git commit -m "feat(resume): accept resume progress fields on PATCH schema"
```

---

## Task 7: PATCH route persists resume fields + `draftData`

**Files:**
- Modify: `src/app/api/application/[referenceId]/route.ts`

**Interfaces:**
- Consumes: `requireDraftAccess` (Task 5), extended schema (Task 6).
- Produces: PATCH persists `currentStep/currentRoute/progressPct/completedSteps/lastActivityAt` and merges `draftData`; auth via `requireDraftAccess`.

- [ ] **Step 1: Swap auth to `requireDraftAccess` and handle resume fields**

Replace the handler body of `PATCH` with this (keeps rate-limit + PAN-encryption behavior, switches auth, adds resume persistence). Full file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getClientIp } from '@/lib/http/ip';
import { encryptPii } from '@/lib/crypto/pii';
import { reportServerError } from '@/lib/http/errors';
import { requireDraftAccess, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { applicationPatchSchema as schema } from '@/lib/validations';
import type { Prisma } from '@prisma/client';

// Progressive save — called after each apply step (and on field blur / debounced
// edits) so the draft is durable and resumable, not only saved at final submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params;
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Auth first: Firebase OR trusted session, draft-scoped. Also confirms the
    // row exists, is a draft, and is owned by the caller.
    const access = await requireDraftAccess(headersList, referenceId);

    const rate = await checkDualRateLimit({ ip, phone: access.mobile, maxRequests: 120, windowMinutes: 60, scope: 'patch' });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Try again in ${Math.ceil((rate.retryAfter ?? 3600) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const { currentRoute, progressPct, completedSteps, draftData, ...fields } = result.data;

    const data: Prisma.ApplicationUpdateInput = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    // PAN is written ONLY through encryptPii — never persisted raw.
    if (typeof data.panNumber === 'string') {
      data.panNumber = encryptPii(data.panNumber) as string;
    }

    // Resume metadata.
    if (currentRoute !== undefined) data.currentRoute = currentRoute;
    if (progressPct !== undefined) data.progressPct = progressPct;
    if (completedSteps !== undefined) data.completedSteps = completedSteps;
    if (draftData !== undefined) {
      // Defensive: PAN must never live in the resumable snapshot.
      const clean = { ...draftData };
      delete (clean as Record<string, unknown>).panNumber;
      data.draftData = clean as Prisma.InputJsonValue;
    }
    // Any PATCH is activity — refresh the resume clock.
    data.lastActivityAt = new Date();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    await db.application.update({ where: { referenceId }, data });
    void recordAudit({ referenceId, actorUid: access.uid, action: 'updated' });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    // 404 (not 500) so this endpoint can't be used to probe which reference IDs
    // exist — but still capture the real cause.
    await reportServerError('application-patch', err);
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
}
```

> Note: `requireDraftAccess` already returns a 401 path via `SessionError` for missing/non-draft/cross-owner rows, so the previous explicit ownership lookup is removed (folded into the authorizer).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the full unit suite** (nothing should regress)

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/application/[referenceId]/route.ts
git commit -m "feat(resume): PATCH persists resume state + merges draftData under draft-scoped auth"
```

---

## Task 8: `start` route mints a trusted session

**Files:**
- Modify: `src/app/api/application/start/route.ts`

**Interfaces:**
- Consumes: `createTrustedSession` (Task 4).
- Produces: on draft create OR resume, a trusted session cookie is minted for the browser; initial `currentStep='otp_verified'`, `currentRoute='/apply/basic-details'`, `completedSteps=['otp_verified']`, `progressPct`, `lastActivityAt`, `expiresAt` set.

- [ ] **Step 1: Add imports** to `src/app/api/application/start/route.ts`

```ts
import { createTrustedSession } from '@/lib/auth/trustedSession';
import { computeProgressPct, routeForStep } from '@/lib/application/progress';
import { TRUSTED_ABSOLUTE_TTL_MS } from '@/lib/auth/constants';
```

- [ ] **Step 2: On create, set resume fields; after create/resume, mint the trusted session**

In the `if (referenceId) { … existing resume … }` branch, after the `db.application.update(...)` call and before `return NextResponse.json({ success: true, referenceId })`, add:

```ts
        await createTrustedSession({ applicationId: existing.id, mobile: session.phone, headers: headersList, ip });
```

(Requires `const headersList = await headers();` — it already exists as `headersList` in this route.)

In the new-draft branch, replace the `db.application.create({ … })` call with one that also seeds resume state, and capture the created row:

```ts
    const newReferenceId = generateReferenceId();
    const created = await db.application.create({
      data: {
        referenceId: newReferenceId,
        mobile: session.phone,
        fullName,
        status: 'draft',
        currentStep: 'otp_verified',
        currentRoute: routeForStep('otp_verified'),
        completedSteps: ['otp_verified'],
        progressPct: computeProgressPct(['otp_verified']),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + TRUSTED_ABSOLUTE_TTL_MS), // draft purge horizon
        source: 'web',
        ...consent_,
        ...whatsapp_,
      },
    });

    await createTrustedSession({ applicationId: created.id, mobile: session.phone, headers: headersList, ip });

    void recordAudit({ referenceId: newReferenceId, actorUid: session.uid, action: 'started' });
    return NextResponse.json({ success: true, referenceId: newReferenceId });
```

> The existing-draft update branch must also fetch `existing.id` — the current code does `db.application.findUnique({ where: { referenceId } })` which already returns the full row (including `id`), so `existing.id` is available.

- [ ] **Step 3: Typecheck + full test suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/application/start/route.ts
git commit -m "feat(resume): mint trusted session + seed resume state on draft start"
```

---

## Task 9: `submit` route accepts trusted session + revokes on success

**Files:**
- Modify: `src/app/api/application/submit/route.ts`

**Interfaces:**
- Consumes: `requireDraftAccess`, `revokeTrustedSession`.
- Produces: submit authorized by Firebase OR trusted session on a draft row; on success the trusted session is revoked (the draft is now submitted and must not be re-opened by the 7-day cookie).

- [ ] **Step 1: Rework auth**

The current route uses `requireSession()` then re-derives ownership. Because a submit targets an existing draft `referenceId`, switch to `requireDraftAccess` when a `referenceId` is present, and keep `requireSession` as the fallback for the rare no-referenceId create-fresh path (which needs a real Firebase identity). Replace the top of the handler:

Existing:
```ts
    const session = await requireSession();

    const headersList = await headers();
    const ip = getClientIp(headersList);
```

Replace with:
```ts
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Peek referenceId to choose the auth path (schema validation happens below).
    const raw = await req.json();
    const refId: string | undefined = typeof raw?.referenceId === 'string' ? raw.referenceId : undefined;

    // A submit that targets an existing draft may be authorized by the trusted
    // session (zero-friction finish on resume). A submit with NO draft to attach
    // to must present a real Firebase session.
    let ownerMobile: string;
    let actorUid: string | undefined;
    if (refId) {
      const access = await requireDraftAccess(headersList, refId);
      ownerMobile = access.mobile;
      actorUid = access.uid;
    } else {
      const session = await requireSession();
      ownerMobile = session.phone;
      actorUid = session.uid;
    }
```

Then change the schema parse to use the already-read body:
```ts
    const result = schema.safeParse(raw);
```
(remove the later `const body = await req.json();` line — the body is now `raw`.)

Replace every subsequent `session.phone` with `ownerMobile`, and `session.uid` with `actorUid`. Specifically:
- rate limits: `checkPhoneRateLimit(ownerMobile, …)`
- ownership check: `if (d.mobile !== ownerMobile) return unauthorized();`
- existing-owner refuse: `if (existing && existing.mobile !== ownerMobile) …`
- audit: `actorUid`
- log line: `maskPhone(ownerMobile)`

Update imports:
```ts
import { requireSession, requireDraftAccess, unauthorized, SessionError } from '@/lib/auth/session';
import { revokeTrustedSession } from '@/lib/auth/trustedSession';
```

- [ ] **Step 2: Revoke the trusted session after a successful submit**

Immediately before the final `return NextResponse.json({ success: true, referenceId, … })`, add:

```ts
    // The draft is now submitted — retire the trusted session so the 7-day cookie
    // can never re-open a completed application.
    await revokeTrustedSession();
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/application/submit/route.ts
git commit -m "feat(resume): allow trusted-session submit; revoke trusted session on success"
```

---

## Task 10: OTP verify — resume-lookup + mint trusted session

**Files:**
- Modify: `src/app/api/otp/verify/route.ts`

**Interfaces:**
- Consumes: `createTrustedSession`, `db`, `computeProgressPct` not needed here.
- Produces: on successful verification, if an unfinished draft exists for the verified mobile, the response includes `{ resume: { referenceId, currentRoute } }` and a trusted session is minted bound to the most-recent draft.

- [ ] **Step 1: Add imports**

```ts
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/http/ip';
import { createTrustedSession } from '@/lib/auth/trustedSession';
```

- [ ] **Step 2: After the session cookie is set, look up the most-recent draft and mint trusted session**

Replace the block that builds `res` and sets the session cookie with:

```ts
    // Establish the strong (1h) server session.
    const res = NextResponse.json({ success: true, verified: true });
    try {
      const sessionCookie = await createSessionCookie(idToken);
      res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions());
    } catch (err) {
      console.error('[otp-verify] session cookie mint failed', { code: (err as { code?: string })?.code });
    }

    // Magic Resume: if this verified mobile has an unfinished draft, bind a fresh
    // trusted session to the MOST RECENTLY ACTIVE one and tell the client where to
    // resume. This is what powers new-device / post-expiry restore.
    try {
      const draft = await db.application.findFirst({
        where: { mobile, status: 'draft' },
        orderBy: { lastActivityAt: 'desc' },
        select: { id: true, referenceId: true, currentRoute: true },
      });
      if (draft) {
        const headersList = await headers();
        await createTrustedSession({
          applicationId: draft.id,
          mobile,
          headers: headersList,
          ip: getClientIp(headersList),
        });
        return NextResponse.json(
          { success: true, verified: true, resume: { referenceId: draft.referenceId, currentRoute: draft.currentRoute ?? '/apply/basic-details' } },
          { headers: res.headers } // carry the Set-Cookie for the session cookie
        );
      }
    } catch (err) {
      // Resume is best-effort; a failure here must not fail verification.
      console.error('[otp-verify] resume lookup failed', { code: (err as { code?: string })?.code });
    }

    return res;
```

> **Cookie-carry note:** `createTrustedSession` sets the trust cookie via `next/headers` `cookies()`, which mutates the outgoing response independently, so it is preserved even when we build a new `NextResponse`. The `{ headers: res.headers }` clause carries the Firebase `Set-Cookie`. Verify in Step 4 that BOTH cookies appear.

- [ ] **Step 3: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Manual smoke (dev bypass) — confirm both cookies set**

Run: `npm run dev`, then in another shell:
```bash
curl -i -X POST http://localhost:3000/api/otp/verify \
  -H 'content-type: application/json' \
  -d '{"mobile":"9876543210","idToken":"<dev-or-real-token>"}'
```
Expected: two `Set-Cookie` headers — `finriseo_session` and `finriseo_trust`. (With no draft for that mobile, only `finriseo_session` — that's correct.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/otp/verify/route.ts
git commit -m "feat(resume): on OTP verify, bind trusted session to most-recent draft + return resume target"
```

---

## Task 11: `GET /api/application/resume` (progress-only)

**Files:**
- Create: `src/app/api/application/resume/route.ts`

**Interfaces:**
- Consumes: `getTrustedSession`, `db`, progress util.
- Produces: `GET` returns `{ hasDraft: boolean, progressPct?, currentStep?, currentRoute?, lastActivityAt?, estRemainingMin?, referenceId? }` — NO PII.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getTrustedSession } from '@/lib/auth/trustedSession';
import { estRemainingMinutes, routeForStep } from '@/lib/application/progress';
import { reportServerError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic'; // reads a cookie; never cache

// Progress-only resume summary for the homepage card. Deliberately returns NO PII
// (no name/email/PIN/income/PAN) — just enough to render "45% complete, continue".
export async function GET() {
  try {
    const headersList = await headers();
    const trusted = await getTrustedSession(headersList);
    if (!trusted) return NextResponse.json({ hasDraft: false });

    const app = await db.application.findFirst({
      where: { id: trusted.applicationId, status: 'draft' },
      select: {
        referenceId: true, currentStep: true, currentRoute: true,
        progressPct: true, lastActivityAt: true,
      },
    });
    if (!app) return NextResponse.json({ hasDraft: false });

    return NextResponse.json({
      hasDraft: true,
      referenceId: app.referenceId,
      currentStep: app.currentStep,
      currentRoute: app.currentRoute ?? routeForStep(app.currentStep),
      progressPct: app.progressPct,
      lastActivityAt: app.lastActivityAt,
      estRemainingMin: estRemainingMinutes(app.currentStep),
    });
  } catch (err) {
    await reportServerError('application-resume', err);
    // Fail closed: on error, act as if there's no resumable draft.
    return NextResponse.json({ hasDraft: false });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/application/resume/route.ts
git commit -m "feat(resume): progress-only resume summary endpoint"
```

---

## Task 12: `GET /api/application/draft` (hydration)

**Files:**
- Create: `src/app/api/application/draft/route.ts`

**Interfaces:**
- Consumes: `getTrustedSession` OR `getSession`, `db`.
- Produces: `GET` returns `{ referenceId, currentRoute, currentStep, fields: { …non-PAN funnel fields } }` for store hydration; PAN excluded.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getTrustedSession } from '@/lib/auth/trustedSession';
import { routeForStep } from '@/lib/application/progress';
import { reportServerError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

// Full NON-SENSITIVE draft for restoring the funnel store. Authorized by the
// trusted session OR the Firebase session. PAN is never returned.
export async function GET() {
  try {
    const headersList = await headers();

    // Resolve the target draft + owner from whichever session is present.
    const trusted = await getTrustedSession(headersList);
    const fb = trusted ? null : await getSession();
    if (!trusted && !fb) return NextResponse.json({ hasDraft: false });

    const where = trusted
      ? { id: trusted.applicationId, status: 'draft' as const }
      : { mobile: fb!.phone, status: 'draft' as const };

    const app = await db.application.findFirst({
      where,
      orderBy: { lastActivityAt: 'desc' },
      select: {
        referenceId: true, currentStep: true, currentRoute: true, draftData: true,
        // Individual columns as a fallback if draftData is absent (older drafts).
        fullName: true, email: true, pinCode: true, employmentType: true,
        salaryMode: true, employer: true, experience: true, loanPurpose: true,
        monthlyIncome: true, loanAmount: true, mobile: true,
        // NOTE: panNumber deliberately NOT selected.
      },
    });
    if (!app) return NextResponse.json({ hasDraft: false });

    // Prefer the JSONB snapshot; fall back to columns. Never include PAN.
    const snapshot = (app.draftData as Record<string, unknown> | null) ?? {};
    const fields = {
      mobile: app.mobile,
      fullName: app.fullName ?? '',
      email: app.email ?? '',
      pinCode: app.pinCode ?? '',
      employmentType: app.employmentType ?? '',
      salaryMode: app.salaryMode ?? '',
      monthlyIncome: app.monthlyIncome != null ? String(app.monthlyIncome) : '',
      loanAmount: app.loanAmount != null ? String(app.loanAmount) : '',
      loanPurpose: app.loanPurpose ?? '',
      ...snapshot,
    };
    delete (fields as Record<string, unknown>).panNumber; // defensive

    return NextResponse.json({
      hasDraft: true,
      referenceId: app.referenceId,
      currentStep: app.currentStep,
      currentRoute: app.currentRoute ?? routeForStep(app.currentStep),
      fields,
    });
  } catch (err) {
    await reportServerError('application-draft', err);
    return NextResponse.json({ hasDraft: false });
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/app/api/application/draft/route.ts
git commit -m "feat(resume): non-sensitive draft hydration endpoint (PAN excluded)"
```

---

## Task 13: Middleware accepts the trusted cookie

**Files:**
- Modify: `src/middleware.ts`

**Interfaces:**
- Produces: apply-step routes are reachable when EITHER `finriseo_session` OR `finriseo_trust` is present.

- [ ] **Step 1: Update the borrower gate**

Add the import:
```ts
import { SESSION_COOKIE, ADMIN_SESSION_COOKIE, TRUSTED_COOKIE } from '@/lib/auth/constants';
```

Replace:
```ts
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();
```
with:
```ts
  // Presence check only (edge runtime). A live Firebase session OR a trusted-
  // browser cookie is enough to REACH the apply steps; the Node route handlers do
  // the real cryptographic/DB validation.
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const hasTrust = Boolean(req.cookies.get(TRUSTED_COOKIE)?.value);
  if (hasSession || hasTrust) return NextResponse.next();
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/middleware.ts
git commit -m "feat(resume): allow apply-step access with trusted cookie"
```

---

## Task 14: Store hydration action

**Files:**
- Modify: `src/store/applicationStore.ts`

**Interfaces:**
- Produces: `hydrateFromServer(fields: Partial<ApplicationData>)` action that merges server draft fields into the store and marks `otpVerified: true` (the session proved ownership).

- [ ] **Step 1: Add the action to the store interface and implementation**

In `interface ApplicationStore`, add:
```ts
  hydrateFromServer: (fields: Partial<ApplicationData>) => void;
```

In the `create<ApplicationStore>(...)` body, add (next to `updateData`):
```ts
  hydrateFromServer: (fields) =>
    set((state) => {
      // Server draft is authoritative on resume. otpVerified is implied by the
      // authorized session that returned this data. PAN is never present here.
      const merged = { ...state, ...fields, otpVerified: true };
      try {
        const safeData = Object.fromEntries(
          Object.entries(merged).filter(([k]) =>
            SESSION_SAFE_FIELDS.includes(k as keyof ApplicationData)
          )
        );
        sessionStorage.setItem('finriseo_progress', JSON.stringify(safeData));
      } catch { /* ignore */ }
      return merged;
    }),
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/store/applicationStore.ts
git commit -m "feat(resume): store hydrateFromServer action"
```

---

## Task 15: `useAutosave` hook

**Files:**
- Create: `src/hooks/useAutosave.ts`

**Interfaces:**
- Consumes: `applicationService.updateApplication`, `progress` util.
- Produces:
  - `useAutosave(referenceId: string | undefined)` returning
    `{ saveStep(stepKey: string, fields: Partial<ApplicationData>): void; saveField(field: keyof ApplicationData, value: unknown): void }`
  - `saveStep` PATCHes immediately (fire-and-forget) with resume metadata derived from `stepKey`.
  - `saveField` debounces (700ms) a single-field PATCH.

- [ ] **Step 1: Implement the hook**

```ts
'use client';

import { useCallback, useRef } from 'react';
import { applicationService } from '@/lib/services';
import type { ApplicationData } from '@/types/application';
import { STEP_KEYS, STEPS, computeProgressPct, routeForStep } from '@/lib/application/progress';

// Build the cumulative completedSteps set up to and including `stepKey`.
function completedThrough(stepKey: string): string[] {
  const idx = STEP_KEYS.indexOf(stepKey);
  if (idx === -1) return [];
  return STEPS.slice(0, idx + 1).map((s) => s.key);
}

/**
 * Draft autosave. `saveStep` persists on Next / step completion with resume
 * metadata; `saveField` debounces per-field blur saves. All saves are
 * fire-and-forget so navigation is never blocked — the DB is the source of truth,
 * and the final submit re-sends everything, so a dropped save never loses data.
 */
export function useAutosave(referenceId: string | undefined) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveStep = useCallback(
    (stepKey: string, fields: Partial<ApplicationData>) => {
      if (!referenceId) return;
      const completed = completedThrough(stepKey);
      // Strip PAN from the resumable snapshot defensively.
      const snapshot: Record<string, unknown> = { ...fields };
      delete snapshot.panNumber;
      void applicationService
        .updateApplication(referenceId, {
          ...fields,
          currentStep: stepKey,
          currentRoute: routeForStep(stepKey),
          progressPct: computeProgressPct(completed),
          completedSteps: completed,
          draftData: snapshot,
        } as Partial<ApplicationData> & Record<string, unknown>)
        .catch(() => {});
    },
    [referenceId]
  );

  const saveField = useCallback(
    (field: keyof ApplicationData, value: unknown) => {
      if (!referenceId) return;
      const key = String(field);
      if (key === 'panNumber') return; // never autosave PAN on blur
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        void applicationService
          .updateApplication(referenceId, { [field]: value } as Partial<ApplicationData>)
          .catch(() => {});
      }, 700);
    },
    [referenceId]
  );

  return { saveStep, saveField };
}
```

> `applicationService.updateApplication`'s second arg is typed `Partial<ApplicationData> & { currentStep?: string }`. Widen it in Task 15b below so `progressPct`, `completedSteps`, `currentRoute`, `draftData` are accepted without `any`.

- [ ] **Step 1b: Widen the service signature** in `src/lib/services/applicationService.ts`

Replace the `updateApplication` signature line:
```ts
  updateApplication: (referenceId: string, data: Partial<ApplicationData> & { currentStep?: string }) =>
```
with:
```ts
  updateApplication: (
    referenceId: string,
    data: Partial<ApplicationData> & {
      currentStep?: string;
      currentRoute?: string;
      progressPct?: number;
      completedSteps?: string[];
      draftData?: Record<string, unknown>;
    }
  ) =>
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/hooks/useAutosave.ts src/lib/services/applicationService.ts
git commit -m "feat(resume): useAutosave hook (step + debounced field saves)"
```

---

## Task 16: `useResumeApplication` hook

**Files:**
- Create: `src/hooks/useResumeApplication.ts`

**Interfaces:**
- Consumes: `apiClient` (via a small fetch), store `hydrateFromServer`, `useRouter`.
- Produces: `useResumeApplication({ autoRoute?: boolean })` that fetches `/api/application/draft`, hydrates the store, and (if `autoRoute`) navigates to `currentRoute`. Returns `{ status: 'idle'|'loading'|'restored'|'none' }`.

- [ ] **Step 1: Implement the hook**

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApplicationStore } from '@/store/applicationStore';
import type { ApplicationData } from '@/types/application';

interface DraftResponse {
  hasDraft: boolean;
  referenceId?: string;
  currentRoute?: string;
  fields?: Partial<ApplicationData>;
}

/**
 * Restore an in-progress draft into the funnel store from the server (trusted or
 * Firebase session). Used by /apply and by the post-OTP restore path. Runs once.
 */
export function useResumeApplication(opts: { autoRoute?: boolean } = {}) {
  const router = useRouter();
  const hydrate = useApplicationStore((s) => s.hydrateFromServer);
  const [status, setStatus] = useState<'idle' | 'loading' | 'restored' | 'none'>('idle');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    setStatus('loading');
    (async () => {
      try {
        const res = await fetch('/api/application/draft', { credentials: 'same-origin' });
        const data: DraftResponse = await res.json();
        if (data.hasDraft && data.fields) {
          hydrate({ ...data.fields, referenceId: data.referenceId });
          setStatus('restored');
          if (opts.autoRoute && data.currentRoute) router.replace(data.currentRoute);
          return;
        }
        setStatus('none');
      } catch {
        setStatus('none');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/hooks/useResumeApplication.ts
git commit -m "feat(resume): useResumeApplication store-restore hook"
```

---

## Task 17: `ResumeJourneyCard` component

**Files:**
- Create: `src/components/sections/ResumeJourney/ResumeJourneyCard.tsx`
- Create: `src/components/sections/ResumeJourney/ResumeJourneyCard.module.css`
- Create: `src/components/sections/ResumeJourney/index.ts`

**Interfaces:**
- Consumes: `/api/application/resume`, `motivationalMessage`, Framer Motion.
- Produces: `ResumeJourneyCard` (default export via index) that self-fetches the summary and renders the premium resume UI, or nothing when there is no draft. Calls optional `onHasDraft(has: boolean)` so a parent can hide its own CTA.

- [ ] **Step 1: Implement the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rocket, Clock, ArrowRight } from 'lucide-react';
import { motivationalMessage } from '@/lib/application/progress';
import styles from './ResumeJourneyCard.module.css';

interface ResumeSummary {
  hasDraft: boolean;
  progressPct?: number;
  currentRoute?: string;
  lastActivityAt?: string;
  estRemainingMin?: number;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 60 * 1000) return 'Just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.round(diffMs / (60 * 1000))} min ago`;
  if (diffMs < day) return 'Today';
  if (diffMs < 2 * day) return 'Yesterday';
  return `${Math.round(diffMs / day)} days ago`;
}

export function ResumeJourneyCard({ onHasDraft }: { onHasDraft?: (has: boolean) => void }) {
  const [summary, setSummary] = useState<ResumeSummary | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/application/resume', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: ResumeSummary) => {
        if (!alive) return;
        setSummary(data);
        onHasDraft?.(Boolean(data.hasDraft));
      })
      .catch(() => { if (alive) onHasDraft?.(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary?.hasDraft) return null;

  const pct = summary.progressPct ?? 0;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className={styles.headerRow}>
        <span className={styles.badge}><Rocket size={16} /> Continue Your Loan Journey</span>
        <span className={styles.lastActivity}>{relativeTime(summary.lastActivityAt)}</span>
      </div>

      <div className={styles.progressTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={styles.progressFill}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
      </div>

      <div className={styles.metaRow}>
        <span className={styles.pct}>{pct}% Completed</span>
        {summary.estRemainingMin ? (
          <span className={styles.eta}><Clock size={14} /> ~{summary.estRemainingMin} min left</span>
        ) : null}
      </div>

      <p className={styles.message}>{motivationalMessage(pct)}</p>

      <Link href={summary.currentRoute ?? '/apply/basic-details'} className={`btn btn--cta btn--lg ${styles.cta}`}>
        Continue Application <ArrowRight size={18} />
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Implement the CSS** (`ResumeJourneyCard.module.css`) — reuse existing design tokens (`--gold-*`, `--green-*`, radii). Match the app's card conventions.

```css
.card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, rgba(0,0,0,0.08));
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
  max-width: 440px;
  width: 100%;
}
.headerRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 0.95rem; color: var(--green-700, #0b6b3a);
}
.lastActivity { font-size: 0.8rem; color: var(--text-muted, #6b7280); white-space: nowrap; }
.progressTrack {
  height: 12px; border-radius: 999px; background: var(--track, #eceff1); overflow: hidden;
}
.progressFill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--green-500, #12a35a), var(--gold-500, #d4a017));
}
.metaRow { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.pct { font-weight: 800; font-size: 1.05rem; color: var(--text, #111827); }
.eta { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-muted, #6b7280); }
.message { margin: 14px 0 20px; font-size: 0.95rem; color: var(--text-muted, #4b5563); line-height: 1.5; }
.cta { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }

@media (prefers-color-scheme: dark) {
  .card { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
  .pct { color: #f3f4f6; }
}
```

> Before finalizing colors, open an existing card CSS module (e.g. `Hero.module.css` or `WhyChooseUs`) and match the actual token names/values in use so this reads as the same design system. Adjust the `var(--…)` fallbacks to the real tokens.

- [ ] **Step 3: Barrel export** (`index.ts`)

```ts
export { ResumeJourneyCard } from './ResumeJourneyCard';
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck` → PASS.

```bash
git add src/components/sections/ResumeJourney
git commit -m "feat(resume): premium ResumeJourneyCard with animated progress"
```

---

## Task 18: Wire the Resume card into the Hero

**Files:**
- Modify: `src/components/sections/Hero/Hero.tsx`

**Interfaces:**
- Produces: when a resumable draft exists, the Hero shows `ResumeJourneyCard` in place of (or above) the quick-start form.

- [ ] **Step 1: Render the card and hide the form when a draft exists**

Add import:
```ts
import { ResumeJourneyCard } from '@/components/sections/ResumeJourney';
```

Add state near the other hooks:
```ts
const [hasDraft, setHasDraft] = useState<boolean>(false);
```

In the JSX where the quick-start form/card renders (the right column), render the resume card and conditionally hide the form:
```tsx
<ResumeJourneyCard onHasDraft={setHasDraft} />
{!hasDraft && (
  /* existing quick-start form JSX unchanged */
)}
```

> Wrap the existing form block in the `{!hasDraft && ( … )}` conditional. `ResumeJourneyCard` renders nothing until it knows there's a draft, so on a first visit the form shows immediately with no flicker (hasDraft starts false).

- [ ] **Step 2: Typecheck + build the app to verify no SSR/client boundary issues**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run dev` and load `/` — first visit shows the form; after completing OTP + a step in another flow, returning to `/` shows the Resume card. (Full manual matrix in Task 20.)

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/Hero/Hero.tsx
git commit -m "feat(resume): show ResumeJourneyCard on the homepage when a draft exists"
```

---

## Task 19: Wire autosave + restore into the funnel

**Files:**
- Modify: `src/app/(apply)/apply/basic-details/page.tsx`
- Modify: `src/app/(apply)/apply/employment/page.tsx`
- Modify: `src/app/(apply)/apply/pan/page.tsx`

**Interfaces:**
- Consumes: `useAutosave` (step key per page), `useResumeApplication` (restore fallback).
- Produces: each step saves via `useAutosave().saveStep(...)` on Next (replacing the ad-hoc `updateApplication` call), and blur autosave via `saveField` on text inputs.

- [ ] **Step 1: basic-details — replace the inline save with `saveStep`**

Add import + hook:
```ts
import { useAutosave } from '@/hooks/useAutosave';
// inside component:
const { saveStep, saveField } = useAutosave(applicationData.referenceId || undefined);
```

Replace the existing `if (applicationData.referenceId) { void applicationService.updateApplication(...) }` block in `onSubmit` with:
```ts
    saveStep('basic_details', {
      loanAmount: data.loanAmount,
      email: data.email,
      pinCode: data.pinCode,
      district: pinResult.location?.district ?? '',
      state: pinResult.location?.state ?? '',
      city: pinResult.location?.city ?? '',
    });
```

Add blur autosave to the email + loanAmount inputs (example for email):
```tsx
onBlur={(e) => saveField('email', e.target.value)}
```
(add `{...register('email')}` already spreads; place `onBlur` after it — RHF merges handlers when you pass onBlur explicitly only if you compose; simplest: use `onBlurCapture` to avoid overriding RHF's onBlur, or call both. Use:)
```tsx
onBlurCapture={(e) => saveField('email', (e.target as HTMLInputElement).value)}
```

- [ ] **Step 2: employment — same pattern with step key `employment`**

```ts
const { saveStep, saveField } = useAutosave(applicationData.referenceId || undefined);
// on submit:
saveStep('employment', {
  monthlyIncome: data.monthlyIncome,
  employmentType: data.employmentType,
  salaryMode: data.salaryMode,
  employer: data.employer,
  experience: data.experience,
});
```
Add `onBlurCapture` field saves to the free-text inputs (employer, experience, monthlyIncome).

- [ ] **Step 3: pan — save step key `pan_verified` WITHOUT PAN in the snapshot**

PAN is submitted at final submit; the PAN step's `saveStep` records progress only (never the PAN value):
```ts
const { saveStep } = useAutosave(applicationData.referenceId || undefined);
// after a valid PAN is entered and the user proceeds:
saveStep('pan_verified', {}); // progress only; PAN is sent at submit, never autosaved
```

- [ ] **Step 4: Add restore fallback on the first post-OTP step** (`basic-details`)

The existing route guard sends users lacking `mobile/otpVerified` to `/apply`. For a trusted-session resume where the in-memory store is empty but the server has the draft, hydrate first. Replace the guard effect in `basic-details/page.tsx`:

```ts
  const { status: resumeStatus } = useResumeApplication();
  useEffect(() => {
    setMounted(true);
    // Only bounce to /apply once we've tried (and failed) to restore from server.
    if (resumeStatus === 'none' && (!applicationData.mobile || !applicationData.otpVerified)) {
      router.replace('/apply');
    }
  }, [resumeStatus, applicationData.mobile, applicationData.otpVerified, router]);
```
Add import:
```ts
import { useResumeApplication } from '@/hooks/useResumeApplication';
```
And guard the early `return null` to also wait while restoring:
```ts
  if (!mounted || resumeStatus === 'loading') return null;
  if (resumeStatus === 'none' && (!applicationData.mobile || !applicationData.otpVerified)) return null;
```

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(apply)/apply/basic-details/page.tsx" "src/app/(apply)/apply/employment/page.tsx" "src/app/(apply)/apply/pan/page.tsx"
git commit -m "feat(resume): autosave step/field data + server restore in the funnel"
```

---

## Task 20: Manual scenario verification

**Files:** none (verification only). Requires the migration applied to a dev DB and dev OTP bypass enabled.

- [ ] **Step 1: Run the automated suite + typecheck + lint + build**

```bash
npm run typecheck && npm test && npm run lint && npm run build
```
Expected: all PASS. (`build` runs `prisma migrate deploy` — ensure the dev DB is intended, or run `next build` alone if not.)

- [ ] **Step 2: Walk the scenario matrix** (record pass/fail for each)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | First visit | Hero shows form; no resume card |
| 2 | Complete OTP + one step, refresh mid-funnel | Same step, values intact (store + trusted cookie) |
| 3 | Close browser, reopen `/` within 7 days | Resume card with correct % + route |
| 4 | Click Continue | Lands on exact step, values restored (no OTP) |
| 5 | `/apply` with trusted cookie, expired Firebase session | Reaches step (middleware) + restores |
| 6 | Session expired (delete `finriseo_session` only) | Trusted cookie still resumes |
| 7 | Delete cookies / incognito | Falls back to OTP |
| 8 | New device → OTP | Most-recent draft restored to exact step |
| 9 | OTP after 7-day expiry | Fresh OTP → restore still works |
| 10 | Multiple drafts | Most recently active resumes |
| 11 | Duplicate prevention | Resuming never creates a second row |
| 12 | Invalid/tampered trust cookie | Treated as no session (fail closed) |
| 13 | Fingerprint change (edit UA) | Downgrades to OTP, no PII leak |
| 14 | Autosave recovery (kill tab after blur) | Blurred field persisted on next load |
| 15 | Submit under trusted session | Succeeds; trusted session revoked; card gone |
| 16 | After submit, revisit `/` | No resume card (draft is submitted) |

- [ ] **Step 3: Commit any fixes found, then finalize**

```bash
git add -A && git commit -m "test(resume): scenario matrix fixes"
```

---

## Self-Review Notes (author)

- **Spec coverage:** DB (Task 1) · trusted session (Tasks 4–5, 8–10, 13) · resume UI (17–18) · restore (10, 12, 16, 19) · autosave (7, 15, 19) · progress util (2) · security: hashed token/fingerprint/draft-scope/sliding (3–5, 8–10) · tests (2–6, 20). New-device full restore (10 + 12 + 19-4). Multi-draft "most recent" (10, 12 `orderBy lastActivityAt desc`). Duplicate prevention (existing idempotent start, unchanged). Submit revoke (9). All spec sections map to a task.
- **PAN exclusion** enforced in Tasks 7, 12, 15 (three layers) + never selected in Task 12.
- **Type consistency:** `requireDraftAccess` returns `{ mobile, uid?, via }` used identically in Tasks 7 & 9; `getTrustedSession` returns `{ applicationId, mobile }` used in Tasks 5, 11, 12; `hydrateFromServer` (Task 14) consumed in Task 16; `saveStep/saveField` (Task 15) consumed in Task 19.
- **No placeholders:** every code step contains full code.
```
