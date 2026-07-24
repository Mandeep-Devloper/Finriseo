/**
 * PIN Code domain logic — pure, environment-agnostic core shared by the client
 * (validation + display) and the server (the /api/pincode proxy). No side
 * effects at import time, so it's safe to pull the regex into validations.ts and
 * the pure functions into Vitest.
 *
 * Primary data source is our self-hosted public.pincodes table (see
 * src/lib/services/pincodeLookup.ts). The India Post API below is the FALLBACK,
 * used only for PINs absent from that table.
 * India Post — https://api.postalpincode.in/pincode/{PINCODE}
 */

// Valid Indian PIN: 6 digits, first digit 1–9 (a leading 0 is never a real PIN,
// so "000000" and other 0-prefixed strings are rejected).
export const PINCODE_REGEX = /^[1-9]\d{5}$/;

/** Normalised location resolved from a PIN code. */
export interface PincodeLocation {
  pincode: string;
  district: string;
  state: string;
  /** Block / post-office locality, when the provider supplies one. */
  city: string;
}

// ── India Post response shape (only the fields we consume are typed) ──
interface IndiaPostPostOffice {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
  Pincode?: string;
}

interface IndiaPostEntry {
  Status?: string;
  PostOffice?: IndiaPostPostOffice[] | null;
}

/** True only for a structurally valid Indian PIN code. */
export function validatePincode(raw: string): boolean {
  return PINCODE_REGEX.test(raw);
}

/** Strip everything that isn't a digit and cap at 6 characters. */
export function sanitizePincode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/**
 * Pure parser/normaliser for the India Post payload. Returns a location only for
 * a genuine hit (`Status === "Success"` with at least one PostOffice); every
 * other case — error status, empty/missing PostOffice, or malformed JSON —
 * returns null, which the caller surfaces as "Invalid PIN Code".
 */
export function parseIndiaPostResponse(json: unknown): PincodeLocation | null {
  if (!Array.isArray(json) || json.length === 0) return null;

  const entry = json[0] as IndiaPostEntry;
  if (entry?.Status !== 'Success') return null;

  const office = entry.PostOffice?.[0];
  if (!office?.District || !office.State) return null;

  return {
    pincode: office.Pincode ?? '',
    district: office.District,
    state: office.State,
    city: office.Block || office.Name || '',
  };
}

const INDIA_POST_URL = 'https://api.postalpincode.in/pincode';

// Cache the upstream response for 30 days: PIN→location is effectively static,
// so this collapses repeat lookups (across all users) to a single origin fetch.
const UPSTREAM_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Fallback lookup: called by lookupPincode() only when a PIN is missing from our
 * self-hosted directory. Resolves to a normalised location, or null when the PIN
 * is unknown. Throws only on a genuine network/HTTP failure so the route can
 * distinguish "invalid" from "unavailable".
 */
export async function fetchPincodeFromIndiaPost(
  pincode: string,
  signal?: AbortSignal
): Promise<PincodeLocation | null> {
  const response = await fetch(`${INDIA_POST_URL}/${pincode}`, {
    signal,
    next: { revalidate: UPSTREAM_REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`India Post responded ${response.status}`);
  }
  return parseIndiaPostResponse(await response.json());
}
