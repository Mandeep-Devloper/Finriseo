import { NextResponse } from 'next/server';

// Minimal liveness probe. Deliberately discloses nothing about the operator,
// environment, or stack — just enough to confirm the app is up.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
