// Sentry — browser init. Runs once when the client bundle loads. A no-op
// until NEXT_PUBLIC_SENTRY_DSN is set (the DSN is inlined at build time).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Never attach PII — the funnel handles phone numbers and PAN.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
