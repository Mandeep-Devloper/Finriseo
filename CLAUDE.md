# CLAUDE.md — Finriseo Engineering Charter

Finriseo is a regulated-adjacent Indian fintech product (loan comparison / DSA lead
platform). Every record in the database is a real person's name, mobile, income and
PAN. **Nothing in this document is style preference — the rules exist because a
mistake here leaks PII or misroutes money.**

This file defines **who owns what** across three roles — Product Design, Frontend
(Next.js), Backend (Node.js) — plus the security duties that belong to all of them.
Read the role section you are acting in, then Section 3 (Invariants) and Section 7
(Security) *always*, regardless of role.

---

## 0. How to use this file

| If you are… | Read |
|---|---|
| Designing a screen, flow, or copy | §1, §3, §4.1, §7.6 |
| Building UI / client state / forms | §1, §2, §3, §4.2, §5, §7.5, §8 |
| Building APIs / DB / auth / jobs | §1, §2, §3, §4.3, §5, §7.1–§7.4, §8 |
| Working on the frontend/backend split | §2, §6 — **and nothing else changes** |
| Reviewing a PR | §3, §7, §8 |

**Rule of first resort:** if a change would violate anything in §3, stop and ask.
Do not "improve" an invariant. They were each written after a specific bug.

---

## 1. What Finriseo is

**Product:** A borrower fills a 5-step funnel (name+mobile → OTP → basic details →
employment → PAN), sees lender offers computed from live eligibility rules, and
submits. The lead lands in an internal admin panel where agents work it through a
pipeline to disbursement.

**Three distinct audiences, three distinct trust levels:**

| Surface | Route group | Auth | Trust |
|---|---|---|---|
| Marketing site | `src/app/(marketing)` | none (public) | untrusted, SEO-critical |
| Apply funnel (borrower) | `src/app/(apply)` | Firebase Phone OTP → `finriseo_session` (1h) | owns exactly one phone number's data |
| Admin panel (staff) | `src/app/(admin)` | Firebase Email/Password → `finriseo_admin_session` (30m) | god-mode over all borrower PII |

**Stack (current):** Next.js 15 App Router + React 19, TypeScript strict, CSS
Modules, Zustand (funnel UI state), react-hook-form + Zod, Prisma 6 → Supabase
Postgres, Firebase Auth (client SDK for OTP, firebase-admin for verification),
Sentry, deployed on Vercel (`bom1`) with Vercel Cron.

**Key domain files:** `prisma/schema.prisma` (data model + retention policy),
`src/lib/validations.ts` (all Zod schemas, client and server),
`src/lib/services/eligibility.ts` (offers engine), `src/lib/constants.ts` (company
facts, consent version, marketed loan ceiling).

---

## 2. Architecture: today vs. target

### Today — one Next.js app
Next.js serves marketing, funnel, admin **and** the API (`src/app/api/**`). Route
handlers run on Node; `src/middleware.ts` runs on edge and does cookie-*presence*
redirects only. Prisma talks to Supabase through the transaction pooler.

### Target — split into two deployables
- **Frontend:** Next.js. Rendering, routing, SEO, forms, session cookie relay. **No
  Prisma. No firebase-admin. No secrets.**
- **Backend:** standalone Node.js service. Every route handler, all DB access, all
  auth verification, all jobs. Owns the only copy of the credentials.

The split is **planned, not started.** Do not restructure directories, extract
packages, or move files toward it unless the task explicitly says so. §6 defines how
it happens when it does.

### The boundary that must already be true today
Even in the monolith, write code as if the wall exists:

```
Browser ──HTTP(cookies)──▶ [ Next.js ] ──HTTP(service call)──▶ [ Node API ] ──▶ Postgres
                             no secrets                          all secrets
```

- A client component may never import from `src/lib/db.ts`, `src/lib/auth/*`,
  `src/lib/crypto/*`, or anything with `import 'server-only'`.
- A route handler may never import a React component or read Zustand state.
- Shared truth (Zod schemas, the permissions matrix, constants) lives in
  edge-safe/isomorphic modules with **no** `server-only` import — see
  `src/lib/auth/permissions.ts` and `src/lib/auth/constants.ts` for the pattern.

---

## 3. Non-negotiable invariants

Break any of these and the change is wrong, no matter how well it tests.

**Authorization**
1. **Middleware is not authorization.** `src/middleware.ts` checks cookie *presence*
   on edge and cannot verify anything cryptographically. Every protected route
   handler and server component calls `requireSession()` (borrower) or
   `requireAdmin([roles])` (admin). No exceptions, including "internal" routes.
2. **The session is the owner, never the request body.** A borrower may only touch
   rows where `application.mobile === session.phone`. See the ownership check in
   `src/app/api/application/submit/route.ts` — the posted `mobile` is compared
   against the session and rejected on mismatch.
3. **Borrower and admin sessions are structurally separate** — different cookies,
   different Firebase auth methods, different TTLs. Never unify them, never let one
   cookie satisfy the other's gate.
4. **The trusted-browser cookie (`finriseo_trust`, 7d) authorizes drafts only.**
   `requireDraftAccess()` hard-fails unless `status === 'draft'`. It must never
   reach a submitted application or any admin route. On submit, the trusted session
   is revoked.
5. **Admin role comes from the database**, not the Firebase token. A valid Firebase
   session with no `active` `AdminUser` row is rejected. `src/lib/auth/permissions.ts`
   is the single capability matrix for both server gates and UI chrome.

**Data**
6. **PAN is written and read only through `src/lib/crypto/pii.ts`.** Never in
   `sessionStorage`, never in `draftData`, never in CSV export, never in a log line.
   Three layers already enforce the `draftData` exclusion — keep all three.
7. **Money is `Decimal`, never `Float`.** `Decimal(14,2)` for amounts,
   `Decimal(6,3)` for rates. No `parseFloat` arithmetic on money anywhere.
8. **The server re-derives loan amount and offer eligibility** via
   `resolveSubmission()`. A client-supplied `loanAmount` or `selectedOfferId` is a
   *proposal*, never authoritative.
9. **Logs are PII-free.** Phones go through `maskPhone()`. Validation failures log
   field *names*, never values. `AuditLog` records `actorUid`, not personal data.

**Responses**
10. **One generic 500.** Unexpected errors → `reportServerError(scope, err)` +
    `serverError()`. Stack traces, Prisma messages and Firebase codes never reach a
    client.
11. **Every mutating endpoint is rate limited** by IP *and* by phone via the
    DB-backed limiter in `src/app/api/otp/_otpStore.ts` (in-memory Maps do not work
    on serverless). Client IP comes from `getClientIp()` only — never raw
    `x-forwarded-for`.
12. **Every state-changing admin action writes an audit entry** through
    `recordAdminAudit()`. `AuditLog` is append-only; never update or delete rows.

**Platform**
13. Env validation stays **lazy** (`getServerEnv()` called at use time). Validating
    at module import breaks `next build`, which runs without secrets — that is also
    why CI can build with no `.env`.
14. `firebase-admin` stays on `^13`. v14's ESM chain 500s every route on Vercel's
    function loader.
15. The CSP in `next.config.ts` keeps `'unsafe-inline'` for scripts **deliberately**
    (static header, no per-request nonce; removing it breaks hydration and OTP).
    `'unsafe-eval'` is removed and stays removed. Adding a third-party script means
    adding a CSP origin — justify it in the PR.

---

## 4. Roles

### 4.1 Product Designer

**Owns:** the design system, information architecture, funnel flow, copy, trust and
consent presentation, accessibility, responsive behaviour.

**Deliverables**
- Flows as state diagrams including the unhappy paths: OTP failed / expired /
  rate-limited, PIN code not found, no eligible offers, session expired mid-funnel,
  resumed draft, submitted-already.
- Screens at 360px, 768px, 1440px. Mobile is the primary target — this is an Indian
  consumer finance funnel.
- Every new token added to `src/app/globals.css`, not invented per-component.

**Design system — the source of truth is `src/app/globals.css`**
- Brand: `--forest-*` (primary), `--gold-*` (accent), `--ink-*` (neutrals).
- Always consume the **semantic** aliases (`--color-primary`, `--color-cta`,
  `--color-text`, `--color-border`, `--color-danger`), not raw ramp values.
- `--green-*`, `--gray-*`, `--emerald-*` are **legacy back-compat aliases**. Never
  use them in new work; migrate opportunistically only in files already being
  changed.
- Fonts are self-hosted via `next/font` (`src/app/layout.tsx`). Never add a Google
  Fonts link — the CSP forbids it and it would be a privacy regression.

**Non-negotiable design rules**
- **No dark patterns.** The WhatsApp opt-in was a pre-ticked locked checkbox; it is
  now a real choice stored in `whatsappOptIn`. Consent to T&C is explicit,
  unticked-by-default, and versioned (`CONSENT_VERSION`). If a design nudges a user
  into consent, it fails review under DPDP.
- **One number for one claim.** The marketed loan ceiling is `MAX_LOAN_DISPLAY` in
  `src/lib/constants.ts`, used everywhere. The site once showed four different
  ceilings simultaneously; never reintroduce a hardcoded figure in copy.
- **Never display full PAN.** Masked in every borrower-facing surface; full value
  only on the audited admin detail view.
- **Trust signals must be true.** Stats, partner counts and ratings in `COMPANY.stats`
  are business claims — flag them for confirmation rather than inventing them.
- Accessibility: WCAG AA contrast, visible focus rings, labels tied to inputs,
  errors announced not just coloured, 44px minimum touch targets, respect
  `prefers-reduced-motion` for all Framer Motion work.
- The apply funnel opens in a new tab and uses a phone-frame layout on desktop; the
  logo there is deliberately **not** clickable (leaving mid-funnel is the drop-off).

**Hands off:** eligibility rules, rate-limit thresholds, session TTLs, audit
requirements. Those are backend decisions with legal weight.

---

### 4.2 Frontend Developer — Next.js

**Owns:** `src/app/(marketing)`, `src/app/(apply)`, `src/app/(admin)` pages/UI,
`src/components/**`, `src/hooks/**`, `src/store/**`, `src/app/globals.css`.

**Mental model:** the frontend renders and collects. It **decides nothing**. Every
authorization outcome, money figure and eligibility result comes from the server.

**Rules**
1. **Server Components by default.** `'use client'` only for interactivity, and push
   it to the leaf — a whole page marked client is a review failure.
2. **Never import server modules into client code.** Anything with
   `import 'server-only'` (`db`, `env`, `session`, `admin`, `pii`, `http/errors`) is
   off-limits. If you need its data, call an API route.
3. **Validate with the shared schemas** in `src/lib/validations.ts` via
   `@hookform/resolvers`. Client validation is UX; the identical schema runs
   server-side. Never fork a rule (e.g. the PIN regex lives in `src/lib/pincode.ts`
   and is imported by both sides).
4. **All network calls go through `src/lib/services/apiClient.ts`.** It normalizes
   `{ data, error, status }` and turns a thrown fetch into a friendly network
   message. No bare `fetch` in components.
5. **State placement:** Zustand (`src/store/applicationStore.ts`) is *funnel UI
   state only*. It is not a cache and not a source of truth. `sessionStorage`
   persistence deliberately excludes PAN — keep that exclusion when touching the
   store.
6. **Handle 401 as a real state.** The borrower session is one hour. A resumed
   funnel must degrade to the resume flow (`useResumeApplication`), not a crash.
7. **UI permission gating is convenience only.** Use `can(role, capability)` to
   hide admin controls, but never assume hiding a button protects the endpoint.
8. **Styling:** CSS Modules colocated with the component (`X.tsx` + `X.module.css`).
   No global class names, no inline style objects for anything themeable, no CSS-in-JS
   libraries. Tokens from `globals.css` only.
9. **Component structure:** `src/components/ui/` = primitives (Toast, OtpInput,
   PincodeInput), `src/components/sections/` = page sections, `src/components/layout/`
   = shells. Each folder ships an `index.ts`. New shared component → the right folder,
   never a one-off copy inside a route.
10. **Performance & SEO** are frontend-owned: `next/image` with the configured
    formats, no layout shift on the hero, metadata + JSON-LD on every marketing page,
    `src/app/sitemap.ts` updated when routes are added.
11. **Never add a network-loading third-party script** without a matching CSP entry
    and a stated reason. `img-src`, `connect-src` and `script-src` are tight on
    purpose.

**Definition of done (frontend):** `npm run typecheck` clean, `npx eslint src
--max-warnings=0` clean, works at 360px, keyboard-navigable, error and loading states
implemented, no new console warnings, no PII written to storage or logs.

---

### 4.3 Backend Developer — Node.js

**Owns:** `src/app/api/**`, `src/lib/auth/**`, `src/lib/services/**`,
`src/lib/crypto/**`, `src/lib/http/**`, `src/lib/db.ts`, `src/lib/env.ts`,
`src/lib/validations.ts` (server schemas), `prisma/**`, `scripts/**`,
`src/middleware.ts`.

**Mental model:** the backend assumes every request is hostile, including ones from
our own UI.

**The canonical route handler order — do not reorder**

```ts
export async function POST(req: NextRequest) {
  try {
    // 1. AUTHENTICATE — before touching the body, before any DB work
    const session = await requireSession();            // or requireAdmin([...])

    // 2. RATE LIMIT — by IP and by identity, DB-backed
    const ip = getClientIp(await headers());
    const check = await checkIpRateLimit(ip, 5, 60, 'scope');
    if (!check.allowed) return /* 429 with retryAfter */;

    // 3. VALIDATE — Zod schema from src/lib/validations.ts
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return /* 400, field NAMES only */;

    // 4. AUTHORIZE THE OBJECT — session owns this specific row
    if (parsed.data.mobile !== session.phone) return unauthorized();

    // 5. RE-DERIVE anything the client could tamper with (amounts, offers)
    // 6. WRITE — money as Decimal, PII through encryptPii()
    // 7. AUDIT — void recordAudit({...}) / recordAdminAudit({...})
    // 8. RESPOND — { success: true, ... }, never echo PII back
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    await reportServerError('scope-name', err);
    return serverError();
  }
}
```

**Rules**
1. **Fail closed.** Missing config, unknown state, unparseable input → deny. The
   retention cron refuses to run when `CRON_SECRET` is unset, rather than running
   unauthenticated. Copy that posture.
2. **Zod at every trust boundary** — HTTP bodies, query params, route params, and
   any external API response (India Post PIN lookup included).
3. **Prisma:** import `db` from `src/lib/db.ts` only (the singleton avoids
   connection exhaustion). Always `select` explicit fields — never return a whole
   `Application` row to a client. Multi-write operations use `$transaction`.
4. **Migrations are additive and reversible in effect.** New columns nullable or
   defaulted so existing rows keep working — every column added to `Lender` follows
   this. Never rename/drop a column in the same PR that stops writing to it.
   `npx prisma migrate dev` locally; deploys run `prisma migrate deploy`.
5. **Every model change updates the retention policy comment** at the top of
   `prisma/schema.prisma` *and* `src/lib/services/retention.ts` if the data is
   personal. Storing PII with no purge rule is a DPDP violation.
6. **Audit before you respond.** `recordAudit`/`recordAdminAudit` are fire-and-forget
   (`void`) so monitoring never breaks a request, but they are not optional.
7. **Secrets** are read via `getServerEnv()` (lazily). Never `process.env.X!` inline
   for a required secret, never a secret in a `NEXT_PUBLIC_*` var, never a default
   value for a secret in code.
8. **Errors:** distinguish `SessionError` (401), `AdminForbiddenError` (403),
   validation (400), rate limit (429), not-found/not-owned (404 — do not confirm
   existence of another user's record). Everything else is a generic 500.
9. **Background jobs** (`src/app/api/cron/*`) authenticate with `CRON_SECRET`, are
   idempotent, and log counts not records.
10. **Third-party calls** (Firebase, India Post) get timeouts, a fallback path, and
    never block a user flow on an outage — the PIN lookup reads the self-hosted
    `pincodes` table first and only falls back to the live API.

**Definition of done (backend):** unit tests for the logic (`*.test.ts` next to the
module, Vitest), `npm test` green, typecheck+lint clean, `npx prisma validate`
clean, auth path tested for both the authorized and unauthorized case, rate limit
present, audit entry written, no PII in any log line.

---

### 4.4 Security — owned by every role

There is no separate security engineer. Each role carries a security mandate:

| Role | Security mandate |
|---|---|
| Product Design | Consent is informed and unticked; no dark patterns; PII shown only where necessary and masked by default; honest claims |
| Frontend | No secrets or server modules in the bundle; no PII in storage/logs/URLs; CSP kept tight; permission-aware chrome |
| Backend | AuthN → AuthZ → rate limit → validate on every route; encryption at rest; audit trail; fail closed; least privilege |

Any PR touching `src/lib/auth/**`, `src/lib/crypto/**`, `src/middleware.ts`,
`next.config.ts` headers, or `prisma/schema.prisma` requires an explicit
security-focused review, and should call out in the description what an attacker
could now do that they could not before.

---

## 5. Ownership map

| Path | Owner | Notes |
|---|---|---|
| `src/app/(marketing)/**` | Frontend + Design | SEO-critical, public |
| `src/app/(apply)/**` | Frontend + Design | Session-gated UI |
| `src/app/(admin)/**` (pages) | Frontend | Must call `requireAdmin` in server components |
| `src/app/api/**` | Backend | The only place secrets are touched |
| `src/components/**`, `src/hooks/**`, `src/store/**` | Frontend | No server imports |
| `src/app/globals.css` | Design + Frontend | Token changes are design decisions |
| `src/lib/validations.ts` | **Shared** | Backend owns the rules; frontend consumes. Change once, both sides follow |
| `src/lib/auth/permissions.ts` | **Shared** | Edge-safe by design; server gate is authoritative |
| `src/lib/auth/constants.ts` | Backend | Edge-safe; cookie names + TTLs |
| `src/lib/constants.ts` | Design + Business | Company facts, consent version, marketed ceiling |
| `src/lib/{db,env,firebase-admin}.ts`, `src/lib/crypto/**`, `src/lib/http/**` | Backend | `server-only` |
| `prisma/**`, `scripts/**` | Backend | Migrations + data jobs |
| `next.config.ts`, `vercel.json`, `.github/workflows/ci.yml` | Backend | Security headers, cron, CI gate |

**Shared files change by agreement.** If a Zod rule changes, both the form and the
route change in the same PR.

---

## 6. The frontend/backend split — rules of engagement

Status: **planned, not started.** Nothing below happens without an explicit task.

### Target layout & hosting decisions

Target monorepo folder layout:

```
finriseo/
├── apps/
│   ├── web/          → Next.js frontend, stays on Vercel (bom1)
│   └── api/          → standalone Node.js service (Fastify), India-region host
├── packages/
│   ├── db/            → Prisma schema + client, shared by web (until cutover) and api
│   └── shared/        → Zod schemas, types, error shapes — zero Next.js imports, zero server-only imports
├── package.json        → npm workspaces
└── turbo.json
```

Hosting decisions:
- Backend host must be an India region (Cloud Run `asia-south1` or DigitalOcean
  Bangalore) — co-located with the database, not Singapore/US, per RBI Digital
  Lending Directions data-localization requirements.
- Database stays Supabase (Mumbai). Do not migrate to Neon — Neon has no India
  region as of 2026.
- A Redis instance is added at the same phase as the backend cutover, for:
  rate-limit backing (already DB-backed per §3.11, this is additive), a job queue
  (BullMQ) for NBFC submission calls and notifications, and general caching. This
  lives in `apps/api`, not `apps/web`.

**Principles when it does happen**
1. **Contract first.** Freeze the current API surface (`src/app/api/**`) as the
   contract. The split must be behaviour-identical on day one — same paths, same
   status codes, same response shapes. No feature work rides along.
2. **Move, don't rewrite.** `src/lib/{auth,services,crypto,http}`, `src/lib/db.ts`,
   `src/lib/env.ts`, `src/lib/validations.ts` and `prisma/` transplant to the Node
   service largely unchanged. Rewriting a working auth gate during a migration is
   how these projects break.
3. **Shared code is exactly:** Zod schemas, the permissions matrix, cookie/TTL
   constants, TypeScript types (`src/types/**`). These must stay free of
   `server-only` and Node built-ins so both sides can import them.
4. **Cookies survive the split.** `finriseo_session`, `finriseo_admin_session` and
   `finriseo_trust` stay `httpOnly` and first-party. Either serve the API under the
   same registrable domain (e.g. `api.finriseo.com` with a domain-scoped cookie) or
   proxy through Next. **Do not** move sessions to `localStorage` tokens to make
   CORS easier — that trades an XSS-proof store for an XSS-readable one.
   Once mobile apps are on the roadmap, `apps/api` must also accept a Firebase ID
   token via an `Authorization` header as an alternative to the session cookie, so
   the same endpoints serve both web and mobile without a second auth path being
   bolted on later.
5. **CORS is an allowlist**, credentialed, exact origins only. Never `*` with
   credentials, never reflect `Origin`.
6. **Once the API is cross-origin, `SameSite` stops being CSRF protection.** Add
   explicit CSRF defence (double-submit token or strict `Origin`/`Sec-Fetch-Site`
   validation) *in the same change* that introduces the cross-origin call.
7. **Security headers must be re-emitted by the backend.** The header block in
   `next.config.ts` covers the Next app only; the Node service needs its own
   equivalent, including `Cache-Control: no-store` on API responses.
8. **Rate limiting stays DB-backed.** Even on a long-lived Node process, in-memory
   counters break the moment there is more than one instance.
9. **Cut over incrementally**, one route group at a time, behind a base-URL env var,
   with the ability to point back at the monolith. Never a big-bang switch.
10. **Move `middleware.ts` logic carefully:** it is a UX redirect layer. The Node
    service must still perform its own full verification — it always did, so nothing
    is lost, but nothing may be assumed either.

See docs/MIGRATION-PLAN.md for the phase-by-phase execution order and per-phase
definition of done.

---

## 7. Security requirements

### 7.1 Authentication
- Borrower: Firebase Phone OTP → ID token → **session cookie** (`httpOnly`, `Secure`
  in prod, `SameSite=Lax`, 1h). Verified with `verifySessionCookie(cookie, true)` —
  the `true` checks revocation.
- Admin: Firebase Email/Password → separate cookie, `SameSite=Strict`, 30m, plus a
  DB check of `AdminUser.active` and `role` on **every** request.
- Trusted browser (Magic Resume): 32-byte random token; only its **SHA-256 hash** is
  stored (`TrustedSession.tokenHash`), soft-bound to a UA+language fingerprint,
  7d sliding with a 30d absolute cap, revocable, draft-scoped.
- Dev OTP bypass (`OTP_DEV_BYPASS`) is local-only and dead in production builds via a
  `NODE_ENV` gate. Never weaken that gate. Localhost is not a Firebase authorized
  domain, so real OTP fails locally — use the bypass, not a code change.

### 7.2 Authorization
- Capability matrix in `src/lib/auth/permissions.ts`: `AGENT` (work leads),
  `ADMIN` (operations, no team/settings), `SUPER_ADMIN` (everything). Least privilege
  — new capabilities start narrow.
- Object-level checks always, not just route-level: owning the session is not owning
  the record.
- Return 404 rather than 403 when denying access to someone else's record, so the
  API does not confirm it exists.

### 7.3 Data protection
- PAN: AES-256-GCM at rest when `PII_ENCRYPTION_KEY` is set, passthrough otherwise
  (current default; key custody is an open decision — §9). All access via
  `encryptPii`/`decryptPii`.
- PII never appears in: `sessionStorage`, `draftData` JSON, CSV exports, URLs, logs,
  Sentry payloads, or audit rows.
- Retention (`src/lib/services/retention.ts`): drafts are purged after
  `STALE_DRAFT_DAYS = 3` of inactivity (`lastActivityAt`) or once `expiresAt` has
  passed; trusted sessions expire; OTP logs are pruned; `AuditLog` is retained
  long-term because it is PII-free. Enforced by the daily cron at
  `/api/cron/retention` (`vercel.json`, 03:00).
- Consent is captured server-side with version, timestamp, IP and user agent — it is
  legal evidence, so never backfill or synthesize it.

### 7.4 Transport & platform
- HSTS 2y + preload, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, COOP `same-origin-allow-popups`,
  `Permissions-Policy` denying camera/mic/geo, `no-store` on all API responses.
- CSP: see §3.15. Adding an origin needs a justification.
- `poweredByHeader: false`. No framework/version disclosure.
- CI fails on any **high/critical production** advisory (`npm audit --omit=dev
  --audit-level=high`). Pinned fixes live in `package.json` `overrides`. Accepted
  moderates are documented in `.github/workflows/ci.yml` — extend that comment rather
  than silently accepting a new one.

### 7.5 Frontend-specific
- Never render untrusted HTML; `dangerouslySetInnerHTML` only for JSON-LD built from
  our own constants.
- No secrets in `NEXT_PUBLIC_*`. Firebase web config is public by design; a service
  account key is not.
- Assume the bundle is readable by an attacker. If knowing it helps them, it does not
  belong in the client.

### 7.6 Design-specific
- Consent copy must state what is agreed to and link the versioned policy.
- Error copy must not leak system detail ("Invalid data" not "Prisma constraint
  failed"), and must not blame the user.
- Masking rules are design decisions with security weight — specify them explicitly
  on every screen showing PAN, mobile or income.

---

## 8. Commands, workflow, and Definition of Done

```bash
npm run dev              # Next dev (turbopack)
npm run typecheck        # tsc --noEmit
npx eslint src --max-warnings=0
npm test                 # vitest run
npm run test:watch
npx prisma validate
npx prisma migrate dev   # local migration
npm run db:seed
npm run db:import-pincodes   # populate the pincodes table (must be run once)
npm run admin:create         # bootstrap an admin user
npx next build           # what CI builds (npm run build also migrates — deploy only)
```

**CI gate (`.github/workflows/ci.yml`), in order:** prisma validate → typecheck →
lint (zero warnings) → vitest → `next build` → dependency audit. CI runs with **no
secrets** — keep env access lazy so this stays true.

**Before claiming anything is done:**
1. Run typecheck, lint and tests — and read the output. Do not assert "passing"
   without having run it.
2. Confirm the invariants in §3 that your change touches.
3. If you touched auth, crypto, headers or the schema, state in the PR what changed
   about the threat model.

**Commit style:** `type(scope): summary` — e.g. `feat(retention):`, `fix(auth):`,
`style(resume):`, `diag(submit):`. Never add AI/Co-Authored-By attribution.

**Tests:** Vitest, `*.test.ts` beside the module. Existing coverage sits on the
security- and money-critical units (`auth/session`, `auth/permissions`,
`auth/trustedSession`, `auth/fingerprint`, `crypto/pii`, `http/ip`, `money`,
`financial`, `eligibility`, `retention`, `validations`). New logic in those areas
ships with tests; UI is verified manually against §4.2's checklist.

---

## 9. Open decisions (need a human, do not guess)

These are marked `TODO(...)` in code and are business/legal calls, not engineering
ones. Flag them; never quietly pick a value.

- `TODO(compliance)` — key-custody model for `PII_ENCRYPTION_KEY` (env secret vs
  managed KMS + rotation) before real PANs are stored. Enabling is incremental: new
  writes encrypt, existing plaintext still reads.
- `TODO(business)` — the real marketed loan ceiling (`MAX_LOAN_DISPLAY`) and the
  trust stats in `COMPANY.stats`.
- `TODO(legal)` — keeping `CONSENT_VERSION` in lockstep with published policy text.
- `TODO(infra)` — `TRUSTED_PROXY_HOPS` for the actual production topology.
- CSP nonce migration (removing script `'unsafe-inline'`) needs middleware-based
  nonce propagation — tracked, not scheduled.
