import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { computeFingerprint } from './fingerprint';
import type { HeaderGetter } from '@/lib/http/ip';
import { TRUSTED_COOKIE, TRUSTED_TTL_MS, TRUSTED_ABSOLUTE_TTL_MS } from './constants';

/** SHA-256 hex of a raw token. Only the hash is ever stored. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function trustedCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/**
 * Mint a fresh trusted session for one browser + draft. Prior live sessions for
 * this application are revoked first so a browser can't accumulate live sessions
 * for the same draft; the new cookie replaces any old one on this browser.
 */
export async function createTrustedSession(args: {
  applicationId: string;
  mobile: string;
  headers: HeaderGetter;
  ip?: string | null;
}): Promise<void> {
  const { applicationId, mobile, headers, ip } = args;
  const raw = randomBytes(32).toString('base64url');
  const now = Date.now();

  // Retire earlier live sessions for this draft (defence against pile-up).
  await db.trustedSession.updateMany({
    where: { applicationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await db.trustedSession.create({
    data: {
      tokenHash: hashToken(raw),
      applicationId,
      mobile,
      fingerprint: computeFingerprint(headers),
      ip: ip ?? null,
      userAgent: (headers.get('user-agent') ?? '').slice(0, 500),
      expiresAt: new Date(now + TRUSTED_TTL_MS),
      absoluteExpiry: new Date(now + TRUSTED_ABSOLUTE_TTL_MS),
    },
  });

  (await cookies()).set(TRUSTED_COOKIE, raw, trustedCookieOptions(TRUSTED_TTL_MS));
}

/**
 * Validate the trusted cookie and, on success, SLIDE its expiry. Returns the
 * draft owner, or null (caller falls back to OTP) when there is no cookie, the
 * row is missing/expired/revoked, or the fingerprint no longer matches.
 */
export async function getTrustedSession(
  headers: HeaderGetter
): Promise<{ applicationId: string; mobile: string } | null> {
  const raw = (await cookies()).get(TRUSTED_COOKIE)?.value;
  if (!raw) return null;

  const row = await db.trustedSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row) return null;

  const now = Date.now();
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < now) return null;
  if (row.absoluteExpiry.getTime() < now) return null;
  if (row.fingerprint !== computeFingerprint(headers)) return null; // soft bind → OTP

  // Slide: extend the window, never past the absolute cap.
  const nextExpiry = Math.min(now + TRUSTED_TTL_MS, row.absoluteExpiry.getTime());
  await db.trustedSession.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date(now), expiresAt: new Date(nextExpiry) },
  });

  return { applicationId: row.applicationId, mobile: row.mobile };
}

/** Revoke the current browser's trusted session and clear its cookie. */
export async function revokeTrustedSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(TRUSTED_COOKIE)?.value;
  if (raw) {
    await db.trustedSession.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(TRUSTED_COOKIE);
}
