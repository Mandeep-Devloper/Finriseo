import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getTrustedSession } from '@/lib/auth/trustedSession';
import { estRemainingMinutes, routeForStep } from '@/lib/application/progress';
import { reportServerError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic'; // reads a cookie; never cache

// Progress-only resume summary for the homepage card. Deliberately returns NO PII
// (no name/email/PIN/income/PAN) — just enough to render "45% complete, continue".
export async function GET() {
  try {
    const headersList = await headers();
    const trusted = await getTrustedSession(headersList);
    if (!trusted) return NextResponse.json({ hasDraft: false });

    const app = await db.application.findFirst({
      where: { id: trusted.applicationId, status: 'draft' },
      select: {
        referenceId: true, currentStep: true, currentRoute: true,
        progressPct: true, lastActivityAt: true,
      },
    });
    if (!app) return NextResponse.json({ hasDraft: false });

    return NextResponse.json({
      hasDraft: true,
      referenceId: app.referenceId,
      currentStep: app.currentStep,
      currentRoute: app.currentRoute ?? routeForStep(app.currentStep),
      progressPct: app.progressPct,
      lastActivityAt: app.lastActivityAt,
      estRemainingMin: estRemainingMinutes(app.currentStep),
    });
  } catch (err) {
    await reportServerError('application-resume', err);
    // Fail closed: on error, act as if there's no resumable draft.
    return NextResponse.json({ hasDraft: false });
  }
}
