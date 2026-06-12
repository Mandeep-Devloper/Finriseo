import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateEMI } from '@/lib/financial';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  loanAmount: z.coerce.number().positive(),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
});

function buildOffers(amount: number, income: number) {
  const eligible = Math.min(amount, income * 10);
  const base = [
    { id: 1, lender: 'Partner A', rate: 10.49, tenure: 36, fee: '1.5%', color: '#0369a1' },
    { id: 2, lender: 'Partner B', rate: 11.25, tenure: 24, fee: '2.0%', color: '#4338ca' },
    { id: 3, lender: 'Partner C', rate: 12.00, tenure: 48, fee: '1.0%', color: '#059669' },
  ];
  return base
    .map((o) => ({
      ...o,
      amount: eligible,
      emi: Math.round(calculateEMI(eligible, o.rate, o.tenure)),
      rateDisplay: `${o.rate}% p.a.`,
      tenureDisplay: `${o.tenure} months`,
    }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const offers = buildOffers(Number(result.data.loanAmount), Number(result.data.monthlyIncome));
    return NextResponse.json({
      success: true,
      offers,
      disclaimer: 'Rates are indicative. Final offer subject to lender approval.',
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
