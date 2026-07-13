// Trusted client-IP extraction for rate limiting and audit.
//
// SECURITY: `X-Forwarded-For` is a client-controllable header. The previous code
// used the ENTIRE raw header string as the rate-limit bucket key, so an attacker
// could send `X-Forwarded-For: <random>` and get a fresh bucket on every request
// — completely bypassing per-IP limits. This module resolves ONE trusted IP token
// instead.
//
// Reverse proxies APPEND the peer address to XFF, so the right-most entries are
// the ones added by infrastructure you control; entries to the left are
// client-supplied and untrustworthy. We therefore:
//   1. Prefer `x-real-ip` (set by the platform edge, e.g. Vercel, to the true
//      client IP; a client-supplied value is overwritten by the proxy).
//   2. Otherwise take the entry `TRUSTED_PROXY_HOPS` positions from the RIGHT of
//      `x-forwarded-for` (default 1 = one trusted proxy hop in front of the app).
//   3. Validate the result is a syntactic IP; fall back to a stable sentinel.
//
// TODO(infra): confirm the trusted-proxy hop count for the actual production
// topology and set TRUSTED_PROXY_HOPS accordingly (Vercel behind no extra proxy
// = 1). This needs the real deployment to verify and is intentionally left
// configurable rather than hard-coded.

/** Minimal shape shared by `Headers` and Next's `ReadonlyHeaders`. */
export interface HeaderGetter {
  get(name: string): string | null;
}

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
// Permissive IPv6 check (hex groups + optional ::/embedded IPv4). We only need to
// reject junk that would poison a rate-limit key, not fully validate RFC 5952.
const IPV6 = /^[0-9a-fA-F:]+(\.\d{1,3}\.\d{1,3}\.\d{1,3})?$/;

function isValidIp(value: string): boolean {
  const v = value.trim();
  if (IPV4.test(v)) return v.split('.').every((o) => Number(o) <= 255);
  return v.includes(':') && IPV6.test(v);
}

function trustedProxyHops(): number {
  const raw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.min(raw, 10);
}

/**
 * Resolve the trusted client IP from request headers. Returns 'unknown' when no
 * trustworthy IP can be determined (all such requests then share one bucket,
 * which is the safe default — they can't each mint a fresh one).
 */
export function getClientIp(headers: HeaderGetter): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      // Count `hops` in from the right (infrastructure-appended, trustworthy).
      const idx = Math.max(0, parts.length - trustedProxyHops());
      const candidate = parts[idx];
      if (candidate && isValidIp(candidate)) return candidate;
    }
  }

  return 'unknown';
}
