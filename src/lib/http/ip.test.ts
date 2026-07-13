import { describe, it, expect, afterEach } from 'vitest';
import { getClientIp, type HeaderGetter } from '@/lib/http/ip';

// Build a case-insensitive header getter from a plain map.
function h(map: Record<string, string>): HeaderGetter {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe('getClientIp', () => {
  it('prefers a valid x-real-ip (platform-set, single value)', () => {
    expect(getClientIp(h({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.2.3.4' })))
      .toBe('203.0.113.5');
  });

  it('takes the right-most (trusted proxy-appended) XFF entry by default', () => {
    // The proxy appends the real client IP; the left entry is client-supplied.
    expect(getClientIp(h({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5' })))
      .toBe('203.0.113.5');
  });

  it('IGNORES a spoofed left-most XFF entry (the rate-limit bypass this fixes)', () => {
    // An attacker prepends junk hoping for a fresh rate-limit bucket. With one
    // trusted hop we still resolve the same real IP regardless of the prefix.
    const a = getClientIp(h({ 'x-forwarded-for': 'evil-1, 203.0.113.5' }));
    const b = getClientIp(h({ 'x-forwarded-for': 'evil-2, 203.0.113.5' }));
    expect(a).toBe('203.0.113.5');
    expect(b).toBe('203.0.113.5');
    expect(a).toBe(b); // same bucket → cannot be rotated
  });

  it('handles a single-value XFF', () => {
    expect(getClientIp(h({ 'x-forwarded-for': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('honours TRUSTED_PROXY_HOPS for deeper proxy chains', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    // client, proxyA, proxyB → 2 hops from the right = proxyA (the client as seen
    // by the outermost trusted proxy).
    expect(getClientIp(h({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9, 203.0.113.5' })))
      .toBe('203.0.113.9');
  });

  it('accepts IPv6 addresses', () => {
    expect(getClientIp(h({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('falls back to XFF when x-real-ip is not a valid IP', () => {
    expect(getClientIp(h({ 'x-real-ip': 'garbage', 'x-forwarded-for': '203.0.113.5' })))
      .toBe('203.0.113.5');
  });

  it('rejects out-of-range IPv4 octets', () => {
    expect(getClientIp(h({ 'x-real-ip': '999.1.1.1' }))).toBe('unknown');
  });

  it('returns "unknown" when no trustworthy IP is present', () => {
    expect(getClientIp(h({}))).toBe('unknown');
    expect(getClientIp(h({ 'x-forwarded-for': 'not-an-ip' }))).toBe('unknown');
  });

  it('clamps an absurd hop count instead of over-reading the chain', () => {
    process.env.TRUSTED_PROXY_HOPS = '999';
    // Clamped to the array length → left-most entry, still a valid resolution.
    expect(getClientIp(h({ 'x-forwarded-for': '203.0.113.1, 203.0.113.2' })))
      .toBe('203.0.113.1');
  });
});
