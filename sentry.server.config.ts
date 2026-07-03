// Sentry — Node runtime (API routes, server components). Loaded via
// src/instrumentation.ts. A no-op until NEXT_PUBLIC_SENTRY_DSN is set, so the
// app runs identically with monitoring off.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  // Error monitoring is the goal; keep tracing cheap.
  tracesSampleRate: 0.1,
  // Never attach request bodies/PII — borrower payloads contain PAN/phone.
  sendDefaultPii: false,
});
