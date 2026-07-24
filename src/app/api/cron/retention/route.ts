import { NextRequest, NextResponse } from 'next/server';
import { purgeRetention } from '@/lib/services/retention';
import { reportServerError, serverError } from '@/lib/http/errors';

// Scheduled data-retention purge. Wired in vercel.json (`crons`). Vercel Cron
// invokes it with `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env
// var is set, which is the only accepted caller — this endpoint must never be
// publicly triggerable (it deletes data).
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  // Fail closed: if no secret is configured, or it doesn't match, refuse.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await purgeRetention();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    await reportServerError('cron-retention', err);
    return serverError();
  }
}
