import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateEMI } from '@/lib/financial';
import { db } from '@/lib/db';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  loanAmount: z.coerce.number().positive(),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
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
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
