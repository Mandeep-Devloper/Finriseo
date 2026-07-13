# Finriseo

A loan DSA (Direct Selling Agent) platform: a marketing site, a phone-OTP loan
application funnel, and a role-based admin panel for working leads through to
disbursement.

## Overview

Three surfaces, one Next.js app:

| Surface | Path | Purpose |
|---|---|---|
| **Marketing** | `/`, `/personal-loan`, `/emi-calculator`, … | SEO pages, loan products, EMI calculator, contact |
| **Apply funnel** | `/apply/*` | 6-step borrower journey: name+mobile → OTP → details → employment → offers → PAN → success |
| **Admin panel** | `/admin/*` | Leads pipeline, lender management, dashboard/KPIs, team & RBAC, audit log, inbox, settings |

Borrowers authenticate with **Firebase Phone Auth (OTP)**; the server verifies
the ID token and mints an httpOnly **Firebase session cookie** (1 h). Admins
authenticate separately with **Firebase Email/Password** on their own cookie
(30 min), with roles (`SUPER_ADMIN` / `ADMIN` / `AGENT`) enforced from the
database via an RBAC capability matrix. Loan offers are computed server-side
from the admin-managed `Lender` table and re-derived on submit so client input
is never trusted.

**Money is stored as `Decimal`** (never float) for exact sums/commission.
**Borrower consent** (Terms/Privacy/credit-bureau) is captured server-side with
timestamp, version, IP and user-agent; the **WhatsApp-updates opt-in** is a
separate, genuinely optional choice persisted per application
(`Application.whatsappOptIn`, tri-state — null means "no signal", never assume
yes). **PAN** is written/read through a single
encryption boundary (`src/lib/crypto/pii.ts`) that is AES-256-GCM encrypted at
rest when `PII_ENCRYPTION_KEY` is set and plaintext-passthrough otherwise.
Per-IP rate limiting resolves a **trusted client IP** (`src/lib/http/ip.ts`) so
`X-Forwarded-For` can't be spoofed to mint fresh buckets.

## Tech stack

- **Next.js 15** (App Router, React 19, TypeScript) — deployed on Vercel
- **Prisma 6** ORM → **Supabase Postgres** (pooled runtime + direct migration URLs)
- **Firebase Auth** — Phone OTP (borrowers) + Email/Password (admins); `firebase-admin` for server-side token/cookie verification
- **Zod 4** for every API input; **React Hook Form** in the funnel; **Zustand** (+ sessionStorage) for funnel state
- **CSS Modules** + framer-motion; no UI framework
- **Vitest** unit tests; **GitHub Actions** CI

## Folder structure

```
src/
├── middleware.ts           # cookie-presence redirects (UX only — NOT the auth boundary)
├── app/
│   ├── (marketing)/        # static/SEO pages
│   ├── (apply)/apply/      # borrower funnel, one route per step
│   ├── (admin)/admin/      # login + (protected)/ leads·lenders·team·audit·inbox·settings
│   └── api/                # application/, otp/, admin/, contact, health
├── lib/
│   ├── auth/               # session.ts (borrower) · admin.ts (admin) · permissions.ts (RBAC matrix)
│   ├── admin/              # leads query/analytics/pipeline vocab/formatters
│   ├── services/           # eligibility engine · firebaseOtp · auditLog · apiClient
│   ├── http/               # ip.ts (trusted client IP) · errors.ts (safe 500 + Sentry)
│   ├── crypto/             # pii.ts (AES-256-GCM PAN encryption boundary)
│   ├── money.ts            # Decimal ↔ number boundary helpers
│   ├── env.ts              # lazy Zod validation of required server env
│   ├── db.ts               # Prisma client singleton
│   └── validations.ts      # all Zod schemas (client + API)
├── components/             # ui/ · sections/ · layout/ (CSS Modules co-located)
├── store/                  # Zustand funnel store (PAN deliberately excluded)
└── types/
prisma/                     # schema + migrations + seed
scripts/admin-create.mjs    # bootstrap the first SUPER_ADMIN
```

**Security boundaries to know:** `requireSession()` (borrower) and
`requireAdmin()` / `getAdminSession()` (admin) are the real gates — every
protected API route and admin page calls them. The middleware only redirects
visitors without a cookie. All admin mutations are role-gated via
`can(role, capability)` and written to an append-only `AuditLog`.

## Installation

Requirements: **Node 22** (see `.nvmrc`), npm.

```bash
git clone <repo-url> && cd finriseo
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in values (see below)
npx prisma migrate deploy   # apply migrations to your database
npm run db:seed             # optional: seed lenders
```

## Environment variables

All documented with sources in [.env.example](.env.example). Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **pooled** connection (port 6543, `?pgbouncer=true&connection_limit=1`) — app runtime |
| `DIRECT_URL` | Supabase **direct** connection (port 5432) — Prisma migrations only |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web app config (public) — API key, auth domain, project id, sender id, app id |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Service-account credentials for `firebase-admin` (keep the literal `\n`s in the key) |
| `OTP_DEV_BYPASS` + `NEXT_PUBLIC_OTP_DEV_BYPASS` | **Dev only** — skip SMS (see below). Never set in production |
| `TRUSTED_PROXY_HOPS` | Trusted reverse-proxy hops for client-IP resolution (default 1; Vercel = 1) |
| `PII_ENCRYPTION_KEY` | Optional 32-byte base64/hex key. Set → PAN is AES-256-GCM encrypted at rest; unset → plaintext passthrough |
| `NEXT_PUBLIC_GA_ID` | Optional GA4 measurement id |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional Sentry DSN — error monitoring (including API-route 500s) is a no-op until set |

Required server vars are validated lazily by [src/lib/env.ts](src/lib/env.ts):
a missing var fails with a clear message on first use, and `next build` works
with no env at all (CI relies on this).

## Local development

```bash
npm run dev          # http://localhost:3000 (Turbopack)
npm test             # Vitest unit tests
npm run test:watch
npm run typecheck    # tsc --noEmit
npm run lint
npx prisma studio    # browse the database
```

**OTP in development:** Firebase blocks Phone Auth SMS on the free Spark plan
(`auth/billing-not-enabled`). Set `OTP_DEV_BYPASS=1` and
`NEXT_PUBLIC_OTP_DEV_BYPASS=1` in `.env` to skip only the SMS: any mobile with
OTP **123456** signs in via a server-minted custom token, so the ID-token →
session-cookie flow stays production-identical. The bypass is dead code in
production builds (`NODE_ENV` gate) and should be removed after upgrading
Firebase to Blaze.

**After running a migration**, restart `next dev` — a stale in-memory Prisma
client causes 500s. Note the Supabase free-tier database pauses when idle
(`P1001` even though the pooler answers TCP); resume it from the dashboard.

## Testing

`npm test` runs the Vitest suite (no DB or network needed — DB access is mocked).
Coverage focuses on the security- and money-critical logic:

| Suite | What it locks down |
|---|---|
| `lib/financial.test.ts` | EMI formula, INR formatting, reference-id shape |
| `lib/money.test.ts` | Decimal ↔ number boundary (no NaN, exact conversion) |
| `lib/http/ip.test.ts` | Trusted client-IP resolution; XFF-spoofing is neutralised |
| `lib/crypto/pii.test.ts` | AES-256-GCM round-trip, passthrough, legacy plaintext, tamper + wrong-key rejection, PAN masking |
| `lib/auth/permissions.test.ts` | RBAC matrix + least-privilege nesting (AGENT ⊂ ADMIN ⊂ SUPER_ADMIN) |
| `lib/services/eligibility.test.ts` | Eligibility filtering, offer caps, submit anti-tampering, Decimal mapping |
| `lib/validations.test.ts` | All Zod API schemas incl. consent + op-discriminated admin mutations |
| `app/api/otp/_otpStore.test.ts` | Rate-limiter allow/block/retry logic + dual-check short-circuit + phone masking |

**Still on the roadmap:** end-to-end (Playwright) smoke tests through the funnel
and admin login, and full HTTP-level route tests (they need a test database or a
heavier Firebase/Prisma mock harness).

## Admin bootstrap

1. In the Firebase console, enable the **Email/Password** sign-in provider.
2. Create the first super admin (Firebase user + `AdminUser` row):

   ```bash
   npm run admin:create -- --email=owner@example.com --name="Owner Name"
   ```

   The script prints a one-time password-set link. Sign in at `/admin/login`.
3. Invite further admins/agents from **/admin/team** (SUPER_ADMIN only).

## Build & deployment

- `npm run build` = `prisma generate && prisma migrate deploy && next build` —
  the Vercel build applies pending migrations, so a deploy and its schema move
  together. Vercel needs all env vars above (set them for Preview too if you
  use branch deploys).
- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs Prisma schema
  validation, typecheck, lint, unit tests, and a production build on every
  push/PR, plus a report-only `npm audit` — no secrets needed, and it
  deliberately does **not** run migrations.
- Security headers + CSP are set in [next.config.ts](next.config.ts).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `auth/billing-not-enabled` on OTP | Firebase Spark plan blocks SMS — upgrade to Blaze, or use the dev bypass locally |
| `[env] Missing/invalid required server env: …` | Fill the listed vars in `.env` / Vercel |
| `P1001: Can't reach database` | Supabase free DB paused — resume from the dashboard |
| 500s right after a migration | Restart `next dev` (stale Prisma client) |
| `verifyIdToken FAILED` in OTP verify | Admin credentials belong to a different Firebase project than the client config |
| Admin login OK but bounced back | No active `AdminUser` row for that Firebase user — run `admin:create` or check `/admin/team` |

## Security model

The security boundaries and how they hold:

| Concern | Mechanism |
|---|---|
| **AuthN (borrower)** | Firebase Phone OTP → server verifies ID token (freshness + revocation) → httpOnly session cookie. `requireSession()` gates every protected route. |
| **AuthN (admin)** | Separate cookie, Firebase Email/Password, `sign_in_provider === 'password'` enforced. `requireAdmin()` re-checks the DB `AdminUser` (`active` + `role`) every request. |
| **AuthZ (RBAC)** | One capability matrix (`lib/auth/permissions.ts`) drives both server `can()` checks and UI gating. Least-privilege, strictly nested AGENT ⊂ ADMIN ⊂ SUPER_ADMIN (unit-tested). |
| **Ownership** | Borrower routes match the session phone; 404 (not 403) on “missing/not-yours” so reference IDs can’t be enumerated. |
| **Anti-tampering** | Loan amount + selected offer re-derived server-side from the live `Lender` table on submit (`resolveSubmission`). |
| **Money integrity** | `Decimal` columns; commission summed in SQL over `NUMERIC`; JS boundary via `lib/money.ts`. |
| **Consent** | Captured server-side (who/when/version/IP/UA) on the draft; original timestamp never overwritten. |
| **PAN at rest** | Single boundary (`lib/crypto/pii.ts`); AES-256-GCM when `PII_ENCRYPTION_KEY` is set. Excluded from sessionStorage, CSV, and logs; masked helper for display. |
| **Rate limiting** | DB-backed atomic upsert (serverless-safe); per-IP + per-phone; IP resolved from a **trusted** hop (`lib/http/ip.ts`) so XFF can’t be spoofed. |
| **Error handling** | `lib/http/errors.ts` returns a fixed generic 500 (no internals leak) and forwards to Sentry when a DSN is set. |
| **Headers/CSP** | HSTS, `frame-ancestors 'none'`, COOP, nosniff, Permissions-Policy, CSP (see `next.config.ts`). |
| **Audit** | Append-only, PII-free `AuditLog` for borrower + admin actions. |

## Roadmap

Done in the latest hardening pass: **Decimal money · consent capture · PAN
encryption boundary · trusted client-IP rate limiting · server-side error
reporting · expanded test suite · defense-in-depth headers.**

Still requires external services / decisions:

- **Upgrade Firebase to Blaze** — production SMS OTP (launch blocker); then remove the dev bypass *(needs billing)*
- **Set `PII_ENCRYPTION_KEY`** + choose key custody (env vs KMS) and backfill existing plaintext PANs *(needs a compliance decision)*
- Admin MFA enrollment (Firebase console + in-app flow) *(needs Firebase config)*
- Document collection (private Supabase Storage bucket + signed URLs)
- Data-retention automation (scheduled purge of stale drafts / OtpLog / resolved contacts) *(needs a cron/Vercel Cron)*
- Nonce-based CSP (drop `unsafe-inline` for scripts — needs middleware nonce propagation)
- E2E smoke tests (Playwright) on the funnel and admin login
