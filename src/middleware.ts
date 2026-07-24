
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, ADMIN_SESSION_COOKIE, TRUSTED_COOKIE } from '@/lib/auth/constants';

// Lightweight cookie-PRESENCE gates that run in the edge runtime. They do NOT
// (and cannot) verify Firebase session cookies cryptographically — firebase-admin
// needs Node APIs. They only bounce obviously-unauthenticated visitors to the
// right entry point. The REAL verification happens in the Node route handlers /
// server layouts: requireSession() (borrower) and requireAdmin()/getAdminSession()
// (admin). Those are the actual security boundaries.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin area ───────────────────────────────────────────────────
  // Gate on the SEPARATE admin cookie. /admin/login is the public entry point
  // and is never gated. A borrower session cookie is irrelevant here — only the
  // admin cookie is checked — so a borrower can never slip into /admin.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname === '/admin/login') return NextResponse.next();
    const hasAdmin = Boolean(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (hasAdmin) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  // ── Borrower apply funnel (existing behaviour, unchanged) ─────────
  // `/apply` itself (name + mobile + OTP step) is intentionally NOT matched —
  // that's where the session gets created.
  // Presence check only (edge runtime). A live Firebase session OR a trusted-
  // browser cookie is enough to REACH the apply steps; the Node route handlers do
  // the real cryptographic/DB validation (and a resuming user whose 1h Firebase
  // session has lapsed then restores from their trusted session).
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const hasTrust = Boolean(req.cookies.get(TRUSTED_COOKIE)?.value);
  if (hasSession || hasTrust) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/apply';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/apply/basic-details',
    '/apply/employment',
    '/apply/offers',
    '/apply/pan',
    '/apply/success',
    '/admin',
    '/admin/:path*',
  ],
};
