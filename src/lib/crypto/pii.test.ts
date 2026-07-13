import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';

// pii.ts is server-only; stub that marker so it imports in the node test env.
vi.mock('server-only', () => ({}));

const KEY = randomBytes(32).toString('base64');

// Each scenario re-imports the module with a controlled env, because the key is
// resolved+cached on first use.
async function loadPii(key?: string) {
  vi.resetModules();
  if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = key;
  return import('@/lib/crypto/pii');
}

beforeEach(() => {
  delete process.env.PII_ENCRYPTION_KEY;
});

describe('pii encryption (key configured)', () => {
  it('round-trips a PAN through encrypt → decrypt', async () => {
    const { encryptPii, decryptPii, isPiiEncryptionEnabled } = await loadPii(KEY);
    expect(isPiiEncryptionEnabled()).toBe(true);
    const enc = encryptPii('ABCDE1234F');
    expect(enc).not.toBe('ABCDE1234F');   // actually transformed
    expect(enc).toMatch(/^enc:v1:/);      // tagged ciphertext
    expect(decryptPii(enc)).toBe('ABCDE1234F');
  });

  it('produces a different ciphertext each time (random IV) but same plaintext', async () => {
    const { encryptPii, decryptPii } = await loadPii(KEY);
    const a = encryptPii('ABCDE1234F');
    const b = encryptPii('ABCDE1234F');
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe(decryptPii(b));
  });

  it('still returns legacy plaintext (untagged) verbatim on read', async () => {
    const { decryptPii } = await loadPii(KEY);
    // A row written before encryption was enabled has no scheme tag.
    expect(decryptPii('ABCDE1234F')).toBe('ABCDE1234F');
  });

  it('rejects tampered ciphertext (GCM auth tag)', async () => {
    const { encryptPii, decryptPii } = await loadPii(KEY);
    const enc = encryptPii('ABCDE1234F')!;
    const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA');
    expect(() => decryptPii(tampered)).toThrow();
  });

  it('rejects a key of the wrong length', async () => {
    const { encryptPii } = await loadPii(randomBytes(16).toString('base64'));
    expect(() => encryptPii('ABCDE1234F')).toThrow(/32 bytes/);
  });
});

describe('pii encryption (no key → passthrough)', () => {
  it('stores/returns values verbatim and reports disabled', async () => {
    const { encryptPii, decryptPii, isPiiEncryptionEnabled } = await loadPii(undefined);
    expect(isPiiEncryptionEnabled()).toBe(false);
    expect(encryptPii('ABCDE1234F')).toBe('ABCDE1234F');
    expect(decryptPii('ABCDE1234F')).toBe('ABCDE1234F');
  });

  it('throws if ciphertext exists but no key is configured (misconfig, not silent)', async () => {
    // Encrypt with a key…
    const withKey = await loadPii(KEY);
    const enc = withKey.encryptPii('ABCDE1234F')!;
    // …then attempt to read it back with the key removed.
    const noKey = await loadPii(undefined);
    expect(() => noKey.decryptPii(enc)).toThrow();
  });

  it('passes null/empty through unchanged', async () => {
    const { encryptPii, decryptPii } = await loadPii(undefined);
    expect(encryptPii(null)).toBeNull();
    expect(encryptPii('')).toBe('');       // empty string is not a value to encrypt
    expect(decryptPii(null)).toBeNull();
    expect(decryptPii('')).toBe('');
  });
});

describe('maskPan', () => {
  it('keeps the issuer prefix + check digit, redacts the core', async () => {
    const { maskPan } = await loadPii(undefined);
    expect(maskPan('ABCDE1234F')).toBe('ABCDE****F');
  });
  it('handles null and malformed values safely', async () => {
    const { maskPan } = await loadPii(undefined);
    expect(maskPan(null)).toBe('—');
    expect(maskPan('short')).toBe('****');
  });
});
