// Next.js instrumentation hook — initializes Sentry per server runtime and
// forwards request errors (API routes, server components) to it. Client-side
// init lives in src/instrumentation-client.ts.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
