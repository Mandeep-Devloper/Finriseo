import { NextResponse } from 'next/server';
import { validatePincode } from '@/lib/pincode';
import { lookupPincode } from '@/lib/services/pincodeLookup';
import { reportServerError } from '@/lib/http/errors';

/**
 * Same-origin PIN → location endpoint. Resolves against our self-hosted
 * public.pincodes directory first and falls back to the live India Post API only
 * for PINs we don't have (see src/lib/services/pincodeLookup.ts). The browser
 * can't call api.postalpincode.in directly (outside our CSP connect-src), so it
 * hits this route; keeping the lookup server-side also lets us swap the data
 * source without touching the client.
 *
 * Response contract (always JSON, never throws to the client):
 *   { status: 'success', location } — resolved
 *   { status: 'invalid' }           — bad format (400) or no match (200)
 *   { status: 'error' }             — upstream/network failure (502)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pincode: string }> }
) {
  const { pincode } = await params;

  if (!validatePincode(pincode)) {
    return NextResponse.json({ status: 'invalid' as const }, { status: 400 });
  }

  try {
    const location = await lookupPincode(pincode);
    if (!location) {
      return NextResponse.json({ status: 'invalid' as const });
    }
    // PIN → location is effectively immutable, so let the browser/CDN cache the
    // hit: a repeat lookup of the same PIN (new tab, returning user, edge) is then
    // served with zero network round-trip to us or the DB. `immutable` skips even
    // revalidation for a day; stale-while-revalidate refreshes in the background.
    return NextResponse.json(
      { status: 'success' as const, location },
      {
        headers: {
          'Cache-Control':
            'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400, immutable',
        },
      }
    );
  } catch (error) {
    await reportServerError('pincode-lookup', error);
    return NextResponse.json({ status: 'error' as const }, { status: 502 });
  }
}
