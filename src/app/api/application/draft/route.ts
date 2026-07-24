import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getTrustedSession } from '@/lib/auth/trustedSession';
import { routeForStep } from '@/lib/application/progress';
import { reportServerError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

// Full NON-SENSITIVE draft for restoring the funnel store. Authorized by the
// trusted session OR the Firebase session. PAN is never returned.
export async function GET() {
  try {
    const headersList = await headers();

    // Resolve the target draft + owner from whichever session is present.
    const trusted = await getTrustedSession(headersList);
    const fb = trusted ? null : await getSession();
    if (!trusted && !fb) return NextResponse.json({ hasDraft: false });

    const where = trusted
      ? { id: trusted.applicationId, status: 'draft' as const }
      : { mobile: fb!.phone, status: 'draft' as const };

    const app = await db.application.findFirst({
      where,
      orderBy: { lastActivityAt: 'desc' },
      select: {
        referenceId: true, currentStep: true, currentRoute: true, draftData: true,
        // Individual columns as a fallback if draftData is absent (older drafts).
        fullName: true, email: true, pinCode: true, employmentType: true,
        salaryMode: true, employer: true, experience: true, loanPurpose: true,
        monthlyIncome: true, loanAmount: true, mobile: true,
        // NOTE: panNumber deliberately NOT selected.
      },
    });
    if (!app) return NextResponse.json({ hasDraft: false });

    // Prefer the JSONB snapshot; fall back to columns. Never include PAN.
    const snapshot = (app.draftData as Record<string, unknown> | null) ?? {};
    const fields = {
      mobile: app.mobile,
      fullName: app.fullName ?? '',
      email: app.email ?? '',
      pinCode: app.pinCode ?? '',
      employmentType: app.employmentType ?? '',
      salaryMode: app.salaryMode ?? '',
      monthlyIncome: app.monthlyIncome != null ? String(app.monthlyIncome) : '',
      loanAmount: app.loanAmount != null ? String(app.loanAmount) : '',
      loanPurpose: app.loanPurpose ?? '',
      ...snapshot,
    };
    delete (fields as Record<string, unknown>).panNumber; // defensive

    return NextResponse.json({
      hasDraft: true,
      referenceId: app.referenceId,
      currentStep: app.currentStep,
      currentRoute: app.currentRoute ?? routeForStep(app.currentStep),
      fields,
    });
  } catch (err) {
    await reportServerError('application-draft', err);
    return NextResponse.json({ hasDraft: false });
  }
}
