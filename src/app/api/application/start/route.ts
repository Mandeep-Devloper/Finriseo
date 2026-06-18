import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateReferenceId } from '@/lib/financial';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  fullName: z.string().min(2),
  referenceId: z.string().optional(),
});

// Creates a draft Application row as soon as OTP is verified — this is what
// makes a lead visible in the database from step 1, instead of only at final
// submit. Idempotent: if referenceId already points to an existing draft for
// the same mobile, it just updates the name instead of creating a duplicate.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const { mobile, fullName, referenceId } = result.data;

    if (referenceId) {
      const existing = await db.application.findUnique({ where: { referenceId } });
      if (existing && existing.mobile === mobile) {
        await db.application.update({ where: { referenceId }, data: { fullName } });
        return NextResponse.json({ success: true, referenceId });
      }
    }

    const newReferenceId = generateReferenceId();
    await db.application.create({
      data: {
        referenceId: newReferenceId,
        mobile,
        fullName,
        status: 'draft',
        currentStep: 'otp_verified',
        source: 'web',
      },
    });

    return NextResponse.json({ success: true, referenceId: newReferenceId });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
