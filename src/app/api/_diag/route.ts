import { NextRequest, NextResponse } from 'next/server';

// TEMPORARY diagnostic route — dynamic-imports each suspect module inside
// try/catch and reports the real error, because Vercel's runtime hides
// module-load failures behind a static HTML /500. Gated by a shared key so it
// discloses nothing to the public (404 without it). REMOVE after the
// firebase-admin route-crash investigation is done.
const DIAG_KEY = 'fnr-diag-8c1f4b2e';

export const dynamic = 'force-dynamic';

type Result = string | { name?: string; code?: string; msg?: string; stack?: string[] };

export async function GET(req: NextRequest) {
  if (req.headers.get('x-diag-key') !== DIAG_KEY) {
    return new NextResponse(null, { status: 404 });
  }

  const out: Record<string, Result> = {};
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['firebase-admin/app', () => import('firebase-admin/app')],
    ['firebase-admin/auth', () => import('firebase-admin/auth')],
    ['lib/firebase-admin', () => import('@/lib/firebase-admin')],
    ['lib/auth/session', () => import('@/lib/auth/session')],
    ['lib/auth/admin', () => import('@/lib/auth/admin')],
  ];
  for (const [name, load] of steps) {
    try {
      await load();
      out[name] = 'ok';
    } catch (e) {
      const err = e as { name?: string; code?: string; message?: string; stack?: string };
      out[name] = {
        name: err?.name,
        code: err?.code,
        msg: String(err?.message ?? '').slice(0, 600),
        stack: String(err?.stack ?? '').split('\n').slice(0, 10),
      };
    }
  }

  return NextResponse.json({
    node: process.version,
    runtime: process.env.NEXT_RUNTIME ?? null,
    env: {
      FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
      FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      DIRECT_URL: Boolean(process.env.DIRECT_URL),
    },
    results: out,
  });
}
