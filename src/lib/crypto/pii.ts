// PII encryption boundary (application-layer, at-rest) — server-only.
//
// The most sensitive borrower field (PAN) is written and read exclusively through
// this module so encryption can be turned on WITHOUT touching call sites: the
// submit/patch routes call encryptPii() on write, the audited admin detail view
// calls decryptPii() on read.
//
// Implementation is dependency-free AES-256-GCM using Node's built-in `crypto`
// (NOT an external KMS/provider — that remains a deliberate ops/compliance
// decision). Behaviour is keyed off one env var:
//
//   PII_ENCRYPTION_KEY unset  → PASSTHROUGH. Values are stored/returned verbatim
//                               (i.e. still plaintext). This keeps local/dev and
//                               the current DB working unchanged.
//   PII_ENCRYPTION_KEY set    → AES-256-GCM. New writes are encrypted; reads
//                               transparently decrypt tagged ciphertext and pass
//                               through any legacy plaintext, so enabling it is a
//                               safe, incremental rollout (no bulk backfill needed
//                               to start).
//
// The key is a 32-byte secret provided as base64 or hex. Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// TODO(compliance): decide the key-custody model (env secret vs a managed KMS
// with rotation) and set PII_ENCRYPTION_KEY in every environment. Rotation +
// backfill of existing plaintext rows is a follow-up once a key is chosen. This
// requires a business/compliance decision and secret management, so it is
// intentionally left as configuration rather than hard-coded.
import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SCHEME = 'enc:v1:'; // tags GCM ciphertext so legacy plaintext is detectable
const ALGO = 'aes-256-gcm';

let keyCache: Buffer | null | undefined; // undefined = not resolved yet; null = no key

function resolveKey(): Buffer | null {
  if (keyCache !== undefined) return keyCache;
  const raw = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!raw) {
    keyCache = null;
    return null;
  }
  // Accept base64 or hex; both must decode to exactly 32 bytes for AES-256.
  let buf: Buffer;
  try {
    buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  } catch {
    throw new Error('[pii] PII_ENCRYPTION_KEY is not valid base64/hex.');
  }
  if (buf.length !== 32) {
    throw new Error(`[pii] PII_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`);
  }
  keyCache = buf;
  return buf;
}

/** True when a valid encryption key is configured (encryption is active). */
export function isPiiEncryptionEnabled(): boolean {
  return resolveKey() !== null;
}

/**
 * Encrypt a PII string for storage. Returns tagged ciphertext when a key is
 * configured, otherwise the input unchanged (passthrough). null/'' pass through.
 */
export function encryptPii(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return plaintext ?? null;
  const key = resolveKey();
  if (!key) return plaintext; // passthrough — no key configured

  const iv = randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SCHEME}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypt a stored PII string. Tagged ciphertext is decrypted; untagged values
 * (legacy plaintext / passthrough writes) are returned as-is.
 */
export function decryptPii(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return stored ?? null;
  if (!stored.startsWith(SCHEME)) return stored; // legacy plaintext / passthrough

  const key = resolveKey();
  if (!key) {
    // Ciphertext exists but no key to read it — a misconfiguration, not a value.
    throw new Error('[pii] Encrypted value found but PII_ENCRYPTION_KEY is not set.');
  }
  const [ivB64, tagB64, ctB64] = stored.slice(SCHEME.length).split(':');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Mask a PAN for display/logging: keep the first 5 and last 1 chars (issuer +
 * check digit), redact the numeric core. `ABCDE1234F` → `ABCDE****F`.
 */
export function maskPan(pan: string | null | undefined): string {
  if (!pan) return '—';
  if (pan.length !== 10) return '****';
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
}
