import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
const cookieJar = {
  get: (k: string) => (store.has(k) ? { value: store.get(k)! } : undefined),
  set: (k: string, v: string) => { store.set(k, v); },
  delete: (k: string) => { store.delete(k); },
};
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(cookieJar) }));

vi.mock('@/lib/db', () => ({
  db: {
    trustedSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { db } from '@/lib/db';
import { computeFingerprint } from './fingerprint';
import {
  hashToken,
  createTrustedSession,
  getTrustedSession,
  revokeTrustedSession,
} from './trustedSession';

const headers = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null });
const H = headers({ 'user-agent': 'UA/1', 'accept-language': 'en-IN' });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('trustedSession', () => {
  it('hashToken is a stable 64-char hex hash', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('createTrustedSession stores a hashed token and sets the cookie', async () => {
    await createTrustedSession({ applicationId: 'app1', mobile: '9876543210', headers: H, ip: '1.1.1.1' });
    expect(store.has('finriseo_trust')).toBe(true);
    const raw = store.get('finriseo_trust')!;
    const createArg = vi.mocked(db.trustedSession.create).mock.calls[0][0].data;
    expect(createArg.tokenHash).toBe(hashToken(raw));       // hash stored, not raw
    expect(createArg.tokenHash).not.toBe(raw);
    expect(createArg.applicationId).toBe('app1');
    expect(createArg.mobile).toBe('9876543210');
  });

  it('getTrustedSession returns owner for a valid, matching-fingerprint session', async () => {
    await createTrustedSession({ applicationId: 'app1', mobile: '9876543210', headers: H });
    const raw = store.get('finriseo_trust')!;
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken(raw), applicationId: 'app1', mobile: '9876543210',
      fingerprint: computeFingerprint(H),
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    const res = await getTrustedSession(H);
    expect(res).toEqual({ applicationId: 'app1', mobile: '9876543210' });
    expect(db.trustedSession.update).toHaveBeenCalled(); // slide
  });

  it('getTrustedSession returns null when expired', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: computeFingerprint(H),
      expiresAt: new Date(Date.now() - 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null when revoked', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: computeFingerprint(H),
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: new Date(),
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null on fingerprint mismatch (downgrade to OTP)', async () => {
    store.set('finriseo_trust', 'rawtoken');
    vi.mocked(db.trustedSession.findUnique).mockResolvedValue({
      id: 't1', tokenHash: hashToken('rawtoken'), applicationId: 'app1', mobile: '9876543210',
      fingerprint: 'a-totally-different-fingerprint',
      expiresAt: new Date(Date.now() + 1000), absoluteExpiry: new Date(Date.now() + 100000),
      revokedAt: null,
    } as never);
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('getTrustedSession returns null when no cookie present', async () => {
    expect(await getTrustedSession(H)).toBeNull();
  });

  it('revokeTrustedSession clears the cookie and marks the row revoked', async () => {
    store.set('finriseo_trust', 'rawtoken');
    await revokeTrustedSession();
    expect(store.has('finriseo_trust')).toBe(false);
    expect(db.trustedSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('rawtoken'), revokedAt: null } })
    );
  });
});
