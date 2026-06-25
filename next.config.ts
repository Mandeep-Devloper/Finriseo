import type { NextConfig } from 'next';

// CSP notes (script-src):
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
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://www.google-analytics.com;
  connect-src 'self'
    https://www.google-analytics.com
    https://analytics.google.com
    https://identitytoolkit.googleapis.com
    https://securetoken.googleapis.com
    https://www.googleapis.com
    https://www.google.com
    https://www.gstatic.com;
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
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
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
