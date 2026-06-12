import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkIpRateLimit } from '@/app/api/otp/_otpStore';
import { headers } from 'next/headers';

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  subject: z.string().min(5),
  message: z.string().min(20).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') 
      ?? headersList.get('x-real-ip') 
      ?? 'unknown';

    const ipCheck = checkIpRateLimit(ip, 3, 60); // 3 submits per hour per IP
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many submissions. Try again in ${Math.ceil((ipCheck.retryAfter ?? 3600) / 60)} minutes.`
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    
    // Server-side validation
    const validatedData = contactSchema.parse(body);

    await db.contactMessage.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        subject: validatedData.subject,
        message: validatedData.message,
      },
    });

    return NextResponse.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input parameters' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
