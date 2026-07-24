import { describe, it, expect } from 'vitest';
import { computeFingerprint } from './fingerprint';

function headers(map: Record<string, string>) {
  return { get: (k: string) => map[k.toLowerCase()] ?? null };
}

describe('computeFingerprint', () => {
  it('is stable for the same UA + Accept-Language', () => {
    const h = headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' });
    expect(computeFingerprint(h)).toBe(computeFingerprint(h));
  });

  it('is a 64-char hex string', () => {
    const fp = computeFingerprint(headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' }));
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when the user agent changes', () => {
    const a = computeFingerprint(headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' }));
    const b = computeFingerprint(headers({ 'user-agent': 'UA/2', 'accept-language': 'en-IN' }));
    expect(a).not.toBe(b);
  });

  it('handles missing headers deterministically', () => {
    expect(computeFingerprint(headers({}))).toMatch(/^[0-9a-f]{64}$/);
  });
});
