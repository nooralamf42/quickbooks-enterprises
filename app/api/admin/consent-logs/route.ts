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

    // --- Group Shopify subscription recurring charges by contract id ---
    const subscriptionGroupsMap = new Map<string, any[]>();
    const ungroupedConsentLogs: any[] = [];

    consentLogs.forEach(log => {
      if (log.shopifySubscriptionContractId) {
        const key = log.shopifySubscriptionContractId;
        if (!subscriptionGroupsMap.has(key)) subscriptionGroupsMap.set(key, []);
        subscriptionGroupsMap.get(key)!.push(log);
      } else {
        ungroupedConsentLogs.push(log);
      }
    });

    const subscriptionGroupRecords = Array.from(subscriptionGroupsMap.values()).map(rawCharges => {
      // Real chronological order — use paidAt/createdAt, NOT agreedTimestamp (the webhook
      // copies agreedTimestamp identically onto every recurring charge, since it represents
      // the original consent-signing event, not each individual billing date).
      const chargesNewestFirst = [...rawCharges].sort((a, b) =>
        new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime()
      );
      const mostRecentCharge = chargesNewestFirst[0];
      const earliestCharge = chargesNewestFirst[chargesNewestFirst.length - 1];
      const totalCollectedUSD = rawCharges.reduce((sum, c) => sum + (Number(c.amountUSD) || 0), 0);

      return {
        ...mostRecentCharge, // status, amountUSD, fsOrderReference, paymentMethodLabel, cardType/Last4,
                             // ipAddress/deviceType/browser, etc. all reflect "current state"
        firstName: earliestCharge.firstName,
        lastName: earliestCharge.lastName,
        email: earliestCharge.email,
        phone: earliestCharge.phone,
        companyName: earliestCharge.companyName,
        ein: earliestCharge.ein,
        address: earliestCharge.address,
        city: earliestCharge.city,
        state: earliestCharge.state,
        zipCode: earliestCharge.zipCode,
        country: earliestCharge.country,
        clientSignatureBase64: earliestCharge.clientSignatureBase64,
        agreedToTerms: earliestCharge.agreedToTerms,
        agreedTimestamp: mostRecentCharge.paidAt || mostRecentCharge.createdAt || mostRecentCharge.agreedTimestamp,
        logType: 'subscription_group',
        _id: mostRecentCharge._id, // action buttons (Send Reminder/Mark as Paid) act on the latest charge
        charges: chargesNewestFirst,
        totalChargesCount: chargesNewestFirst.length,
        totalCollectedUSD,
      };
    });

    const combinedLogs = [
      ...ungroupedConsentLogs.map(log => ({ ...log, logType: 'consent' })),
      ...subscriptionGroupRecords,
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
