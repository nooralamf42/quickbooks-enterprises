import { NextResponse } from 'next/server';

// ePay payment gateway has been removed.
// This webhook route is kept as a stub.
export async function POST() {
  return NextResponse.json({ received: false, message: 'Gateway removed' }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ status: 'inactive' }, { status: 200 });
}
