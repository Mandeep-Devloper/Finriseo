# Migration Plan — monolith → `apps/web` + `apps/api`

This plan is the phase-by-phase execution order referenced by
[CLAUDE.md §6](../CLAUDE.md) ("The frontend/backend split — rules of engagement").
**§6 owns the rules** (contract-first, move-don't-rewrite, cookies survive the
split, CORS allowlist, CSRF once cross-origin, target layout, hosting decisions).
This document does not restate them — it sequences the work against *this*
codebase, as it exists today, so the two documents can't drift apart.

Every number below was produced by grepping/counting the repository on
2026-07-31, not estimated. Section 1 shows the commands.

---

## 1. What the audit found

| Metric | Count | Source |
|---|---|---|
| Route handler files under `src/app/api/**` | **25** | `find src/app/api -name route.ts \| wc -l` |
| HTTP endpoints (one file, `lenders/[id]/route.ts`, exports both `PATCH` and `DELETE`) | **26** | method export scan, below |
| LOC in `src/app/api/**` (26 non-test `.ts` files: 25 `route.ts` + `_otpStore.ts`) | **1,930** | `find src/app/api -name '*.ts' -not -name '*.test.ts' \| xargs cat \| wc -l` |
| LOC in `src/lib/**` (38 non-test `.ts` files) | **2,735** | same pattern against `src/lib` |
| **Combined LOC that moves toward `apps/api`** | **4,665** | sum of the two above |
| Files in `src/lib/**` coupled to `next/headers` / `next/server` / `NextRequest` / `NextResponse` | **4** | `grep -rlE "next/headers\|next/server\|NextRequest\|NextResponse" src/lib --include='*.ts'` (tests excluded) |
| Admin Server Components (no `'use client'`) importing `@/lib/db` or `@/lib/admin/*` directly | **9** | manual pass over all 11 `page.tsx` under `src/app/(admin)/**`, below |
| Apply-funnel pages already `'use client'` and already reaching `apiClient`/`applicationService` (directly or via a hook) | **6 of 6** | manual pass over all `page.tsx` under `src/app/(apply)/**`, below |

**The apply funnel is already decoupled.** All six pages under
`src/app/(apply)/apply/**` are Client Components and already talk to the backend
exclusively through `src/lib/services/apiClient.ts` (or the `applicationService`
built on it) — either directly or through `useAutosave`/`useResumeApplication`.
**Budget the majority of migration effort on the 9 admin Server Components**,
which query Prisma directly inside the component and have **no corresponding API
endpoint today** — Phase 6 below has to invent one endpoint per page before it can
even start moving anything.

### 1.1 — The 25 route handlers, by domain

```
auth/otp     otp/verify (POST), otp/dev-bypass (POST)                     _otpStore.ts (shared rate limiter, not a route)
auth         auth/logout (POST)
users        application/resume (GET), application/status/[referenceId] (GET),
             application/[referenceId] (PATCH), pincode/[pincode] (GET)
leads        application/start (POST), application/draft (GET), application/submit (POST)
loans        application/offers (POST)
admin        admin/auth/login (POST), admin/auth/logout (POST),
             admin/applications/[referenceId] (PATCH),
             admin/applications/[referenceId]/notes (POST),
             admin/applications/export (GET),
             admin/contact/[id] (PATCH),
             admin/lenders (POST), admin/lenders/[id] (PATCH, DELETE),
             admin/settings (PATCH),
             admin/team (POST), admin/team/[id] (PATCH)
notifications  contact (POST)
health       health (GET)
jobs         cron/retention (GET)
```

### 1.2 — The 4 Next.js-coupled files in `src/lib/**`

| File | LOC | Couples to |
|---|---|---|
| `src/lib/auth/session.ts` | 120 | `cookies()` (`next/headers`), `NextResponse` (`next/server`) |
| `src/lib/auth/admin.ts` | 132 | `cookies()` (`next/headers`), `NextResponse` (`next/server`) |
| `src/lib/auth/trustedSession.ts` | 102 | `cookies()` (`next/headers`) |
| `src/lib/http/errors.ts` | 36 | `NextResponse` (`next/server`) |

Three of the four sit under `src/lib/auth/` — these are "the three Next-coupled
auth files" referenced in Phase 4. `http/errors.ts` is a fourth, smaller file (one
`NextResponse.json()` wrapper) that also needs a Fastify-native replacement; it
is grouped with the response-shape work in Phase 2/4 rather than "auth" because
it isn't part of the auth boundary.

Everything else in `src/lib/**` — `validations.ts`, `money.ts`, `financial.ts`,
`pincode.ts`, `constants.ts`, `auth/permissions.ts`, `auth/constants.ts`,
`admin/pipeline.ts`, `types/application.ts` — was grepped for the same patterns
and returns **zero matches**. These are exactly the Phase 2 candidates.

### 1.3 — The 9 admin Server Components with no API endpoint today

All 11 `page.tsx` files under `src/app/(admin)/**` were checked for a `'use
client'` directive and for a direct import of `@/lib/db` or `@/lib/admin/*`.
Two are excluded and nine remain:

- **Excluded:** `admin/login/page.tsx` (`'use client'` — Firebase client SDK) and
  `admin/(protected)/lenders/new/page.tsx` (a Server Component, but it only calls
  `getAdminSession()`/`can()` for the auth gate; the actual write goes through
  `POST /api/admin/lenders` from the client-side `LenderForm`, so it needs no new
  read endpoint).
- **The 9 that need one**, with what they currently import directly:

| Page | Direct import |
|---|---|
| `(protected)/page.tsx` (dashboard) | `getDashboardData` from `@/lib/admin/analytics`, plus `@/lib/admin/{pipeline,audit,format}` |
| `(protected)/leads/page.tsx` | list/query helpers from `@/lib/admin/applications`, `@/lib/admin/{format,searchParams}` |
| `(protected)/leads/[referenceId]/page.tsx` | detail helpers from `@/lib/admin/applications`, `@/lib/admin/{format,pipeline,audit}` |
| `(protected)/inbox/page.tsx` | `db` directly, plus `@/lib/admin/{format,searchParams}` |
| `(protected)/lenders/page.tsx` | `db` directly, plus `@/lib/admin/format` |
| `(protected)/lenders/[id]/edit/page.tsx` | `db` directly |
| `(protected)/team/page.tsx` | `db` directly |
| `(protected)/settings/page.tsx` | `getAppSettings` from `@/lib/admin/settings` |
| `(protected)/audit/page.tsx` | `listAuditLog`/`getAuditActors` from `@/lib/admin/auditQuery`, plus `@/lib/admin/{audit,format,searchParams}` |

None of these nine call `fetch` or `apiClient` for their primary read — they are
Server Components that query Prisma (directly or via a `@/lib/admin/*` helper) at
render time. Moving `apps/api` out of process breaks all nine unless each gets a
replacement endpoint first (Phase 6).

### 1.4 — The apply funnel: already decoupled

| Page | Client Component? | Reaches the API via |
|---|---|---|
| `apply/page.tsx` | yes | `apiClient` directly (name+mobile / OTP) |
| `apply/basic-details/page.tsx` | yes | `useAutosave` → `applicationService` → `apiClient` |
| `apply/employment/page.tsx` | yes | `useAutosave` → `applicationService` → `apiClient` |
| `apply/pan/page.tsx` | yes | `useAutosave` → `applicationService` → `apiClient` |
| `apply/offers/page.tsx` | yes | `apiClient` directly (fetch offers, submit) |
| `apply/success/page.tsx` | yes | `apiClient` directly (status poll) |

One exception worth flagging now because it changes Phase 5/7, not because it
blocks anything: `src/hooks/useResumeApplication.ts` calls
`fetch('/api/application/draft', { credentials: 'same-origin' })` **directly**,
bypassing `apiClient.ts` entirely. It is a second place that needs the
cross-origin `credentials`/base-URL fix in Phase 7, not just `apiClient.ts`.

---

## 2. Target shape

Monorepo with `apps/web` (Next.js, stays on Vercel `bom1`), `apps/api`
(standalone Node.js service), `packages/db` (Prisma), `packages/shared` (Zod
schemas, types, error shapes). Full folder layout, hosting decisions (India
region, Supabase Mumbai, Redis at cutover) and the ten numbered rules of
engagement — contract-first, move-don't-rewrite, cookies survive the split, CORS
allowlist, CSRF once cross-origin, re-emitted security headers, DB-backed rate
limiting, incremental cutover, careful `middleware.ts` handling — all live in
**[CLAUDE.md §6](../CLAUDE.md#6-the-frontendbackend-split--rules-of-engagement)**.
Read that section before starting any phase below; it is not repeated here so
the two documents cannot say two different things.

---

## 3. Phases

### Phase 1 — Monorepo restructure

Move `src/app/(marketing|apply|admin)/**`, `src/components/**`, `src/hooks/**`,
`src/store/**` and the rest of the Next app into `apps/web`. Set up npm
workspaces + Turborepo at the root. **Files are moved, not rewritten** — this
phase touches zero logic, only paths and import specifiers.

**Definition of done:**
- `npm run build`, `npm test`, `npm run typecheck` all pass from the new root,
  with output identical to pre-move.
- Zero behavioral diff: every one of the 25 route handlers still resolves at its
  current path, still returns the same status codes and bodies.
- No file's content changed except import paths mechanically rewritten by the
  move.

### Phase 2 — Extract `packages/shared`

Move the 9 files confirmed Next.js-free in §1.2 — `validations.ts`, `money.ts`,
`financial.ts`, `pincode.ts`, `constants.ts`, `auth/permissions.ts`,
`auth/constants.ts`, `admin/pipeline.ts`, `types/application.ts` — into
`packages/shared`, importable from both `apps/web` and `apps/api`.

**Definition of done:**
- `grep -rE "from ['\"]next/|NextRequest|NextResponse" packages/shared/src`
  returns **nothing**. This is the same command that produced the "4 files"
  count in §1.2 — rerun it against the new location as the acceptance check.
- Both apps import from `packages/shared` and build clean.
- The Zod schemas in `packages/shared` are the *only* copy — no fork between web
  validation and API validation (CLAUDE.md §5: change the rule once, both sides
  follow).

### Phase 3 — `apps/api` scaffold + `packages/db`

Stand up the Fastify service and move `prisma/` into `packages/db` (schema
unchanged, per CLAUDE.md §6.2 — "move, don't rewrite"). First milestone is
deliberately tiny: `GET /health` plus one real query, proving the service can
reach the database at all before any route logic moves.

Switch `apps/api`'s Postgres connection from the **transaction pooler (port
6543)** — what `DATABASE_URL` points at today, per `.env.example`, because the
Next app is a serverless/edge-friendly runtime — to the **session/direct
connection (port 5432)**, i.e. what `DIRECT_URL` points at today. `apps/api` is a
long-running process, not a serverless function stack, so it should hold direct
connections rather than cycling through the pooler meant for high-churn
serverless invocations.

**Definition of done:**
- `GET /health` responds from `apps/api`, independently of `apps/web`.
- One real Prisma query round-trips against Supabase over the direct connection
  (port 5432), confirmed with a query log or explicit connection-string check —
  not just "the app started."
- `prisma/schema.prisma` is byte-identical to the one currently at the repo root
  (schema unchanged — confirms "move, don't rewrite" held).
- `apps/web` still builds and runs against its own (unmoved) Prisma client —
  Phase 3 does not cut the frontend over to anything yet.

### Phase 4 — Auth moves early

Normally auth is the last thing to migrate. Here it moves **right after the
scaffold**, out of order, for a reason specific to this project: there are
**zero live users today**, and per the gate audit in §1 — 15 of the 25 route
files call `requireSession()`, `requireAdmin()`, or `requireDraftAccess()`
directly, and every other route is either an auth-bootstrap endpoint itself
(`otp/verify`, `otp/dev-bypass`, `admin/auth/login`, `admin/auth/logout`,
`auth/logout`), an intentionally-public endpoint (`health`, `contact`,
`pincode/[pincode]`), a secret-gated job (`cron/retention`, via `CRON_SECRET`),
or an auth-optional read that degrades gracefully with no session
(`application/draft`, `application/resume`, both call `getSession()`/
`getTrustedSession()` directly and return `{ hasDraft: false }` rather than
throwing). In other words: nothing meaningful in this codebase is reachable
without going through the auth layer, so there's no benefit to migrating
low-risk routes first and saving the highest-risk one for last — do the highest-
risk thing first, while there is no production traffic to break.

Rewrite the three Next-coupled files under `src/lib/auth/` (`session.ts`,
`admin.ts`, `trustedSession.ts` — §1.2) against Fastify's cookie APIs
(`@fastify/cookie` or equivalent), plus `http/errors.ts`'s `NextResponse.json`
wrapper. Cookie config: `Domain=.finriseo.com`, `HttpOnly`, `Secure`,
`SameSite=Lax`. CORS: explicit origin allowlist, `credentials: true`, never `*`
(per CLAUDE.md §6.5).

**Definition of done:**
- All three borrower/admin/trusted-session flows work end-to-end against
  `apps/api`: OTP verify → session cookie → protected read; admin login → admin
  cookie → `requireAdmin` gate; trusted-session draft resume.
- The four files from §1.2 have zero remaining `next/headers` / `next/server`
  imports; a rerun of the §1.2 grep against `apps/api` returns nothing.
- Cookies set by `apps/api` are readable by `apps/web` in the same browser
  (`Domain=.finriseo.com` verified with a real cross-subdomain request, not just
  code review).
- CORS rejects an origin not on the allowlist (tested with a deliberate
  off-allowlist request, expecting the browser to block it).

### Phase 5 — Migrate routes via the strangler pattern

Move the remaining route logic (everything outside `src/lib/auth/`) from the 25
handlers in §1.1 into `apps/api`, domain by domain (`users`, `leads`, `loans`,
`admin`, `notifications`). At each step, the **existing Next.js route handler
becomes a thin proxy** that forwards to the new `apps/api` endpoint — frontend
code (`apiClient.ts`, the six apply-funnel pages, the `useResumeApplication`
bare-`fetch` call from §1.4) is unchanged until the whole domain is proven, then
the proxy for that domain is deleted.

**Definition of done, per domain:**
- The `apps/api` endpoint returns byte-identical status codes and JSON shapes to
  what the original Next handler returned (this is the CLAUDE.md §6.1
  contract-first requirement, checked empirically, not just by code diff).
- The proxy route in `apps/web` is a pure pass-through — no business logic re-
  added at the proxy layer.
- Once a domain's proxy has run in production with no regressions, the proxy file
  is deleted and `apiClient.ts` calls (or, for the `useResumeApplication`
  exception, the bare `fetch`) point straight at `apps/api`.

### Phase 6 — Admin Server Components

For each of the 9 pages identified in §1.3:

1. Add the missing read endpoint to `apps/api` (e.g. `GET /api/admin/leads`,
   `GET /api/admin/dashboard`, `GET /api/admin/audit`, one per page — none of
   these exist today; this is new surface area, not a move).
2. Replace the direct `db.*`/`@/lib/admin/*` call in the page with a server-side
   `fetch()` to that endpoint.
3. **Forward the admin cookie explicitly.** Because the fetch happens
   server-side (inside the Server Component, on the Node runtime, not in the
   browser), it does **not** automatically attach the browser's cookies. Read it
   from `cookies()` and set it explicitly on the outgoing request, e.g.:

   ```ts
   const cookieHeader = (await cookies()).toString();
   const res = await fetch(`${API_BASE_URL}/api/admin/leads?...`, {
     headers: { cookie: cookieHeader },
   });
   ```

   **Forgetting this returns a silent 401 or an empty page, not a visible
   error** — the Server Component just renders its empty/forbidden state, and
   without deliberately testing the authenticated path, this looks like a
   successful migration until a real admin fails to see their data in
   production.

**Definition of done:**
- All 9 pages render with real data when fetched with an authenticated admin
  cookie, and render their existing "forbidden" state when fetched without one
  (i.e. the 401 path was actually exercised, not just the happy path).
- Each new endpoint lives under `apps/api`'s `admin` domain and is covered by the
  same `requireAdmin()`-equivalent gate the Server Component used inline before
  (no regression in the role check — `can(admin.role, ...)` results must match).
- `db` and `@/lib/admin/*` imports are gone from all 9 page files; grep confirms
  zero remaining `from '@/lib/db'` / `from '@/lib/admin/` in
  `apps/web/src/app/(admin)/**`.

### Phase 7 — Deploy and cleanup

**Hosting:** the backend host must be an India region — Cloud Run `asia-south1`
or DigitalOcean Bangalore — co-located with the database. Database stays
Supabase (Mumbai); do not move to Neon (no India region) or host the API in
Singapore/US (RBI Digital Lending Directions data-localization requirement, per
CLAUDE.md §6).

**Concrete things in *this* codebase that break silently on cutover** —
each one was found by reading the actual file, not inferred:

- **`next.config.ts`'s CSP `connect-src`** (line 28 onward) lists `'self'` plus a
  fixed allowlist — Google Analytics, Firebase Auth (`identitytoolkit`,
  `securetoken`, `googleapis`), Sentry. It has **no entry for a new API host**.
  Until `https://api.finriseo.com` (or whatever the API host is) is added here,
  every browser call to it is silently blocked by CSP — not a CORS error, a CSP
  violation, which shows up in the console but not as a request the network tab
  even attempts in some browsers.
- **`src/lib/services/apiClient.ts`** calls `fetch(endpoint, options)` with a
  bare relative `endpoint` and no `credentials` option — meaning the browser
  default (`same-origin`) applies. Once `apps/api` is on a different origin, this
  silently stops sending the session cookie: requests still return 200 for
  public endpoints and a **silent 401 for anything gated**, with no code change
  needed to trigger it — the origin change alone breaks it. Needs
  `credentials: 'include'` plus an absolute base URL (env-configured, per
  CLAUDE.md §6.9's incremental-cutover base-URL var). The bare `fetch` in
  `src/hooks/useResumeApplication.ts` (found in §1.4) needs the identical fix
  independently — it does not go through `apiClient.ts` and will not be fixed by
  changing that file alone.
- **`vercel.json`'s cron** (`{ "path": "/api/cron/retention", "schedule": "0 3
  * * *" }`) invokes `/api/cron/retention` on the Vercel-hosted `apps/web`. Once
  that route's logic moves to `apps/api` (Phase 5), this cron entry starts
  hitting a 404 on `apps/web` every night — retention silently stops running.
  Needs either a secret-authenticated proxy route kept on `apps/web` purely to
  forward the cron trigger to `apps/api`, or the schedule moved to whatever
  scheduler `apps/api`'s host provides (Cloud Scheduler for Cloud Run,
  DigitalOcean's own cron), re-authenticated with the same `CRON_SECRET` check
  the handler already does.

**Cleanup checklist:**
- [ ] Delete the Phase 5 proxy routes once each domain is confirmed stable.
- [ ] Remove `@prisma/client` (and `firebase-admin`) from `apps/web`'s
      `package.json` — once Phase 6 removes the last direct `db` import from the
      admin pages, `apps/web` no longer needs either.
- [ ] Remove server-only env vars (`DATABASE_URL`, `DIRECT_URL`,
      `FIREBASE_PRIVATE_KEY`, etc.) from the `apps/web` Vercel project — they
      belong to `apps/api`'s host only from this point on.
- [ ] Lock CORS on `apps/api` down to the real production + staging domains —
      remove any wildcard or development-only origin left over from Phase 4/5
      testing.

---

## 4. Known traps

- **Vercel preview deployments break auth on every preview, by design, until
  this is planned around.** Every preview gets a random `*.vercel.app` hostname.
  The Phase 4 cookie config is `Domain=.finriseo.com` — a `*.vercel.app` preview
  is not a subdomain of `finriseo.com`, so the browser will not attach the
  cookie at all. This isn't a bug to fix in the cookie code; it means **every**
  preview deployment is auth-broken from the moment Phase 4 ships, for anything
  gated behind a session. Decide on a stable staging domain (e.g.
  `staging.finriseo.com` pointed at a fixed preview or staging deployment)
  *before* Phase 4 ships, not after someone notices login doesn't work on a PR
  preview.

- **Repo visibility.** This repository's current public/private visibility was
  not part of this audit's scope to change, but once `apps/api` exists it holds
  the only copy of backend secrets' *code path* (not the secrets themselves,
  which stay in env vars) plus the full admin authorization logic. Keep
  `apps/api` in a private repo or a private workspace package once it is
  created, rather than defaulting to whatever visibility this repo already has.
