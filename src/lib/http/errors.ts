// Shared server-side error handling for API routes.
//
// Two guarantees for every unexpected failure:
//   1. The CLIENT never sees internals — callers return serverError(), a fixed
//      generic 500. Stack traces / DB messages / Firebase codes never leak.
//   2. The TEAM still finds out — reportServerError() logs a PII-free summary and,
//      when a Sentry DSN is configured, forwards the exception. Sentry is pulled
//      in via a DYNAMIC import so the SDK is never loaded/executed with monitoring
//      off (identical to the instrumentation.ts strategy).
//
// Route catch blocks that already special-case auth/validation errors should call
// reportServerError() + serverError() for the final "unexpected" branch only.
import 'server-only';
import { NextResponse } from 'next/server';

/** Log a PII-free summary and, if a DSN is set, forward the error to Sentry. */
export async function reportServerError(scope: string, err: unknown): Promise<void> {
  // Never log the request payload — borrower errors can carry PAN/phone/income.
  console.error(`[${scope}]`, {
    name: (err as { name?: string })?.name,
    code: (err as { code?: string })?.code,
    message: (err as { message?: string })?.message,
  });
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, { tags: { scope } });
  } catch {
    /* monitoring must never break the request */
  }
}

/** The single generic 500 body. Use everywhere so no route leaks internals. */
export function serverError(): NextResponse {
  return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
}
