import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { getEligibleLenders, buildOffers } from '@/lib/services/eligibility';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { offersSchema as schema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown';
    // Generous: offers re-compute as the user tweaks amount/income, but this
    // still caps scripted enumeration of the lender table.
    const rate = await checkDualRateLimit({ ip, phone: session.phone, maxRequests: 60, windowMinutes: 60, scope: 'offers' });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Try again in ${Math.ceil((rate.retryAfter ?? 3600) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    // Offers are computed from the posted figures; still ensure the request
    // comes from the session that owns this phone, not an arbitrary caller.
    if (result.data.mobile !== session.phone) {
      return unauthorized();
    }

    const amount = Number(result.data.loanAmount);
    const income = Number(result.data.monthlyIncome);

    // Pull live lenders the applicant qualifies for, best-priority first, and
    // build the display offers — same logic the submit route re-validates against.
    const lenders = await getEligibleLenders(income);
    const offers = buildOffers(lenders, amount, income);

    return NextResponse.json({
      success: true,
      offers,
      disclaimer: 'Rates are indicative. Final offer subject to lender approval.',
    });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
