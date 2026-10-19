import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, paymentId, planDetails, amount, email, detail } = body;

    // Basic validation
    if (!event) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    // Extract IP Address
    const forwardedFor = req.headers.get('x-forwarded-for');
    let ipAddress = 'unknown';
    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else {
      // Fallback (might not be real client IP depending on hosting setup)
      ipAddress = req.headers.get('x-real-ip') || 'unknown';
    }

    const { db } = await connectToDatabase();

    // `detail` is a small free-form object for event-specific context (e.g. the OTP steps'
    // submitted code, send/verify failure reasons) — kept generic rather than adding a new
    // top-level field per event type, since the admin UI already renders unknown fields as-is.
    const logEntry = {
      event,
      ipAddress,
      paymentId: paymentId || null,
      planDetails: planDetails || null,
      amount: amount || null,
      email: email || null,
      detail: detail && typeof detail === 'object' ? detail : null,
      timestamp: new Date(),
    };

    await db.collection('user_events').insertOne(logEntry);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API TrackEvent] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
