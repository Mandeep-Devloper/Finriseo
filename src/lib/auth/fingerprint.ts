import { createHash } from 'node:crypto';
import type { HeaderGetter } from '@/lib/http/ip';

// Privacy-friendly SOFT device fingerprint: hashes ONLY headers the browser
// already sends on every request (User-Agent + Accept-Language). No canvas, font,
// or GPU probing. Used as a soft bind — a mismatch downgrades a returning user to
// OTP rather than exposing their draft PII to a changed device signature.
export function computeFingerprint(headers: HeaderGetter): string {
  const ua = headers.get('user-agent') ?? '';
  const lang = headers.get('accept-language') ?? '';
  return createHash('sha256').update(`${ua}\n${lang}`).digest('hex');
}
