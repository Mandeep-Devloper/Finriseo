import { describe, it, expect, vi, beforeEach } from 'vitest';

// Control the borrower session cookie value per-test.
const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: (k: string) => (cookieStore.has(k) ? { value: cookieStore.get(k)! } : undefined),
  }),
}));

// Control what verifySessionCookie returns (drives getSession()).
const verifySessionCookie = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifySessionCookie }),
}));

vi.mock('@/lib/db', () => ({ db: { application: { findUnique: vi.fn() } } }));
vi.mock('./trustedSession', () => ({ getTrustedSession: vi.fn() }));

import { db } from '@/lib/db';
import { getTrustedSession } from './trustedSession';
import { requireDraftAccess, SessionError } from './session';

const H = { get: () => null };

beforeEach(() => {
  cookieStore.clear();
  vi.clearAllMocks();
});

/** Make getSession() resolve to a signed-in borrower. */
function signedIn(phone: string, uid = 'u1') {
  cookieStore.set('finriseo_session', 'cookie-value');
  verifySessionCookie.mockResolvedValue({ uid, phone_number: `+91${phone}` });
}

describe('requireDraftAccess', () => {
  it('authorizes via a matching Firebase session on a draft row', async () => {
    signedIn('9876543210');
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    const res = await requireDraftAccess(H, 'FINABC123');
    expect(res).toMatchObject({ mobile: '9876543210', via: 'firebase' });
  });

  it('authorizes via a matching trusted session on a draft row', async () => {
    // no borrower cookie → getSession() returns null
    vi.mocked(getTrustedSession).mockResolvedValue({ applicationId: 'app1', mobile: '9876543210' });
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    const res = await requireDraftAccess(H, 'FINABC123');
    expect(res).toMatchObject({ mobile: '9876543210', via: 'trusted' });
  });

  it('rejects a trusted session pointing at a different application', async () => {
    vi.mocked(getTrustedSession).mockResolvedValue({ applicationId: 'OTHER', mobile: '9876543210' });
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });

  it('rejects when the row is not a draft (already submitted)', async () => {
    signedIn('9876543210');
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'submitted',
    } as never);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });

  it('rejects when neither session authorizes', async () => {
    vi.mocked(getTrustedSession).mockResolvedValue(null);
    vi.mocked(db.application.findUnique).mockResolvedValue({
      id: 'app1', mobile: '9876543210', status: 'draft',
    } as never);
    await expect(requireDraftAccess(H, 'FINABC123')).rejects.toBeInstanceOf(SessionError);
  });
});
