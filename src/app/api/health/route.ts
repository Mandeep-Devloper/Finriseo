import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    status: 'success',
    product: 'Finriseo',
    operator: 'UpAndAlone Fintech Pvt. Ltd.',
    timestamp: new Date().toISOString(),
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
  });
}
