import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    // Admin password authorization check
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const consentLogs = await db
      .collection('admindata')
      .find({})
      .sort({ agreedTimestamp: -1 })
      .toArray();

    const includeEvents = req.nextUrl.searchParams.get('includeEvents') === 'true';
    let groupedSessions: any[] = [];

    if (includeEvents) {
      const userEvents = await db
        .collection('user_events')
        .find({})
        .sort({ timestamp: 1 }) // oldest first for chronological processing
        .toArray();

      const sessionsMap = new Map();
      userEvents.forEach(event => {
        // Group by paymentId + ipAddress so the same link sent to different
        // people (different IPs) creates separate sessions, not one merged log.
        const paymentPart = event.paymentId || 'noid';
        const ipPart = event.ipAddress || 'noip';
        const key = `${paymentPart}__${ipPart}`;

        if (!sessionsMap.has(key)) {
          sessionsMap.set(key, {
            _id: `session_${key}_${event._id}`,
            logType: 'user_session',
            paymentId: event.paymentId,
            ipAddress: event.ipAddress,
            email: event.email,
            planDetails: event.planDetails,
            amount: event.amount,
            agreedTimestamp: event.timestamp,
            events: []
          });
        }
        
        const session = sessionsMap.get(key);
        
        if (event.email) session.email = event.email;
        if (event.planDetails) session.planDetails = event.planDetails;
        if (event.amount) session.amount = event.amount;
        
        if (event.paymentId) {
          if (event.paymentId.endsWith('GAP')) session.paymentGateway = 'AsiaPay';
          else if (event.paymentId.endsWith('GT')) session.paymentGateway = 'Stripe';
          else if (event.paymentId.endsWith('GA')) session.paymentGateway = 'Authorize.net';
          else if (event.paymentId.endsWith('GO')) session.paymentGateway = 'Online Payment';
        }
        
        session.agreedTimestamp = event.timestamp;
        session.events.push(event);
      });

      groupedSessions = Array.from(sessionsMap.values());
    }

    const combinedLogs = [
      ...consentLogs.map(log => ({ ...log, logType: 'consent' })),
      ...groupedSessions
    ].sort((a, b) => {
      const dateA = new Date(a.agreedTimestamp).getTime();
      const dateB = new Date(b.agreedTimestamp).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ logs: combinedLogs });
  } catch (err: any) {
    console.error('[API ConsentLogs] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
