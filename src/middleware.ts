import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

// Lightweight gate for the post-OTP apply sub-routes. This runs in the edge
// runtime, so it does NOT (and cannot) verify the Firebase session cookie
// cryptographically — firebase-admin needs Node APIs. It only checks the cookie
// is present and bounces obviously-unauthenticated visitors back to the funnel
// entry. The real verification happens in the Node route handlers via
// requireSession(); the API routes are the actual security boundary.
//
// `/apply` itself (the name + mobile + OTP step) is intentionally NOT matched —
// that's where the session gets created.
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

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
  ],
};
