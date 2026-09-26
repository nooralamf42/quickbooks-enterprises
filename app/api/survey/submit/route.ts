import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { score, reason, customerEmail, customerName, companyName } = body;

    if (score === undefined || score === null || typeof score !== 'number' || score < 0 || score > 10) {
      return NextResponse.json({ error: 'Valid score (0-10) is required.' }, { status: 400 });
    }

    // IP and User-Agent are read server-side from the request itself, not trusted from
    // the client body — same pattern as /api/track-event. The client-sent `browser`
    // field (if any) is display-only; this is the value actually stored.
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const { db } = await connectToDatabase();

    const feedbackData = {
      customerEmail: customerEmail || 'unknown',
      customerName: customerName || '',
      companyName: companyName || '',
      ipAddress,
      userAgent,
      score,
      reason: reason || '',
      submittedAt: new Date().toISOString(),
      status: 'new',
    };

    await db.collection('surveys').insertOne(feedbackData);

    return NextResponse.json({ success: true, message: 'Survey submitted successfully.' });
  } catch (error: any) {
    console.error('Failed to submit survey:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
