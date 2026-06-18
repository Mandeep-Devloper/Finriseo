import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Every field optional — each funnel step saves only what it collected.
const schema = z.object({
  loanAmount: z.coerce.number().positive().optional(),
  email: z.string().email().optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  employmentType: z.string().min(1).optional(),
  monthlyIncome: z.coerce.number().positive().optional(),
  salaryMode: z.string().min(1).optional(),
  employer: z.string().optional(),
  experience: z.string().optional(),
  loanPurpose: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  currentStep: z.string().optional(),
});

// Progressive save — called after each apply step so the lead's data is
// visible in the database immediately, not only after final submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params;
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const data = Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    await db.application.update({ where: { referenceId }, data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
}
