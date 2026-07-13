import type { NextConfig } from 'next';

// CSP notes (script-src):
//   - fonts.googleapis.com / fonts.gstatic.com were REMOVED from style-src /
//     font-src: all fonts are now self-hosted via next/font (src/app/layout.tsx),
//     so no request ever goes to Google Fonts.
//   - 'unsafe-eval' has been REMOVED — GA4/gtag, GTM (standard tags), the
//     Firebase Auth web SDK, and invisible reCAPTCHA do not require eval in our
//     usage, so dropping it shrinks the XSS surface.
//   - 'unsafe-inline' is RETAINED deliberately. This CSP is emitted as a static
//     response header (next.config headers()), so there is no per-request nonce
//     to authorize inline scripts. Next.js App Router injects inline
//     hydration/bootstrap scripts, and GTM/GA + reCAPTCHA also use inline
//     snippets; removing 'unsafe-inline' here would break hydration and the OTP
//     flow. Moving to a nonce/hash-based policy needs middleware-based nonce
//     propagation (a larger change) and is tracked as a follow-up.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'
    https://www.googletagmanager.com
    https://www.google-analytics.com
    https://www.gstatic.com
    https://www.google.com
    https://recaptcha.google.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: blob: https://www.google-analytics.com;
  connect-src 'self'
    https://www.google-analytics.com
    https://analytics.google.com
    https://identitytoolkit.googleapis.com
    https://securetoken.googleapis.com
    https://www.googleapis.com
    https://www.google.com
    https://www.gstatic.com
    https://*.ingest.sentry.io
    https://*.ingest.us.sentry.io
    https://*.ingest.de.sentry.io;
  frame-src 'self' 
    https://www.google.com 
    https://recaptcha.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Isolate our top-level browsing context from cross-origin openers (Spectre /
  // tab-nabbing defence). `-allow-popups` keeps any popup-based auth working; the
  // OTP flow uses an invisible-reCAPTCHA *iframe* (unaffected by COOP).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Block legacy Flash/PDF cross-domain policy files.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // firebase-admin is a heavy Node-only SDK with dynamic requires; Next
  // already externalizes it by default — this just makes that explicit.
  // NOTE: keep firebase-admin on ^13. v14's chain (jwks-rsa@4 → jose@6,
  // ESM-only) hits ERR_REQUIRE_ESM in Vercel's function loader even on
  // Node 22, which 500s every route that imports firebase-admin/auth.
  serverExternalPackages: ['firebase-admin'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 2592000,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/(.*)',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Redirect old Vite routes if any were indexed by Google
      { source: '/home', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
