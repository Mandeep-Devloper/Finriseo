// Next.js instrumentation hook — initializes Sentry per server runtime and
// forwards request errors (API routes, server components) to it.
//
// IMPORTANT: everything here is gated on NEXT_PUBLIC_SENTRY_DSN and Sentry is
// only ever pulled in via *dynamic* import. With no DSN, register() and
// onRequestError load NOTHING from @sentry/nextjs — no SDK, no OpenTelemetry,
// no import-in-the-middle module-load hook.
//
// Why this matters: @sentry/nextjs's server SDK sets up OpenTelemetry, which
// installs a require/import hook to patch native deps. Without wrapping
// next.config in withSentryConfig, that machinery gets bundled into each
// serverless function, and on Vercel it breaks the loading of heavy Node
// packages — notably firebase-admin (grpc/protobuf/http) — 500-ing every route
// that verifies a Firebase token (all of /api/admin/* and the borrower funnel).
// Loading Sentry only when a DSN is actually set keeps the app byte-for-byte
// identical to its pre-Sentry behaviour when monitoring is off.
//
// When you DO configure a DSN, also wrap next.config.ts with withSentryConfig
// so the OpenTelemetry packages are externalized correctly for the serverless
// runtime — that is the supported setup for the SDK's server instrumentation.
import type * as SentryType from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// Kept as a passthrough so Next's error reporting still reaches Sentry once a
// DSN is set, without importing the SDK when it isn't. The type-only import
// above is erased at build time, so no runtime dependency is created here.
export async function onRequestError(
  ...args: Parameters<typeof SentryType.captureRequestError>
) {
  if (!SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
}
