import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  const { referenceId } = await params;
  if (!referenceId?.startsWith('FIN')) {
    return NextResponse.json({ success: false, error: 'Invalid reference ID' }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    referenceId,
    status: 'under_review',
    steps: [
      { step: 'Application Received', status: 'completed', time: new Date().toISOString() },
      { step: 'Under Review', status: 'active' },
      { step: 'Lender Processing', status: 'pending' },
      { step: 'Disbursement', status: 'pending' },
    ],
  });
}
