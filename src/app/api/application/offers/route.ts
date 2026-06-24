import { NextRequest, NextResponse } from 'next/server';
import { calculateEMI } from '@/lib/financial';
import { db } from '@/lib/db';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { offersSchema as schema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

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

    // Pull live lenders the applicant qualifies for, best-priority first.
    const lenders = await db.lender.findMany({
      where: { active: true, minIncome: { lte: income } },
      orderBy: [{ priority: 'desc' }, { interestRate: 'asc' }],
    });

    const offers = lenders.map((l) => {
      const eligible = Math.min(amount, income * l.maxMultiplier);
      return {
        id: l.id,
        lender: l.name,
        rate: l.interestRate,
        tenure: l.tenureMonths,
        fee: l.processingFee,
        color: l.color,
        amount: eligible,
        emi: Math.round(calculateEMI(eligible, l.interestRate, l.tenureMonths)),
        rateDisplay: `${l.interestRate}% p.a.`,
        tenureDisplay: `${l.tenureMonths} months`,
      };
    });

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
