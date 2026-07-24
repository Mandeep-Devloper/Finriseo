/**
 * Server-only PIN → location resolver used by the /api/pincode route.
 *
 * Strategy: self-hosted DB first, India Post second.
 *   1. Query public.pincodes (populated by scripts/import-pincodes.mjs). This
 *      resolves the ~19k known Indian PINs with a single indexed lookup and NO
 *      runtime dependency on India Post.
 *   2. Only when a PIN is absent from our table (a newer/edge-case PIN) do we
 *      fall back to the live India Post API, so coverage stays complete.
 *
 * Kept out of src/lib/pincode.ts on purpose: that module is imported by client
 * code (validations, PincodeInput), so it must stay free of Prisma / server deps.
 */
import 'server-only';
import { db } from '@/lib/db';
import { fetchPincodeFromIndiaPost, type PincodeLocation } from '@/lib/pincode';

// State names in the India Post dataset are UPPERCASE ("RAJASTHAN"); districts
// are already mixed-case. Title-case for display so the UI reads "Rajasthan".
function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Resolve a (validated) 6-digit PIN to a normalised location, or null when it is
 * unknown to both our directory and India Post. Throws only on a genuine India
 * Post network/HTTP failure (the DB path never throws for "not found"), letting
 * the route distinguish "invalid" from "temporarily unavailable".
 */
export async function lookupPincode(
  pincode: string,
  signal?: AbortSignal
): Promise<PincodeLocation | null> {
  // 1 — self-hosted directory (primary). Any office row carries this PIN's
  // district/state (they're identical across a PIN's offices).
  const row = await db.pincode.findFirst({
    where: { pincode },
    select: { pincode: true, district: true, state: true, taluk: true, officeName: true },
  });

  if (row) {
    return {
      pincode: row.pincode,
      district: toTitleCase(row.district),
      state: toTitleCase(row.state),
      // Block/locality: taluk is the closest analogue to India Post's "Block";
      // fall back to the office name when the source left taluk as NA/null.
      city: toTitleCase(row.taluk ?? row.officeName ?? ''),
    };
  }

  // 2 — live India Post fallback for PINs not yet in our dataset.
  return fetchPincodeFromIndiaPost(pincode, signal);
}
