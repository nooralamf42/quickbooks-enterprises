import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden in production' }, { status: 403 });
    }

    // Admin password authorization check
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const firstNames = ['Sarah', 'David', 'Emma', 'Michael', 'Robert', 'Lisa', 'William', 'Karen'];
    const lastNames = ['Johnson', 'Smith', 'Davis', 'Wilson', 'Brown', 'Taylor', 'Thomas', 'Anderson'];
    const companies = ['Apex Global Solutions', 'Starlight Tech Inc', 'Blue River Logistics', 'Vanguard Consulting', 'Summit Enterprise Partners'];
    const states = ['NY', 'CA', 'TX', 'FL', 'IL', 'KY', 'OH', 'WA'];
    const editions = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'FSP'];

    // Select random mock billing details
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const companyName = companies[Math.floor(Math.random() * companies.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const edition = editions[Math.floor(Math.random() * editions.length)];
    
    const amountUSD = parseFloat((Math.random() * 8000 + 1000).toFixed(2));
    const orderRef = 'QB-MOCK-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    const { db } = await connectToDatabase();

    const mockRecord = {
      email,
      firstName,
      lastName,
      companyName,
      phone: '555-01' + Math.floor(Math.random() * 90 + 10),
      address: Math.floor(Math.random() * 900 + 100) + ' Main Street',
      city: 'Metro City',
      state,
      zipCode: Math.floor(Math.random() * 90000 + 10000).toString(),
      country: 'US',
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 253 + 2),
      browser: ['Google Chrome', 'Apple Safari', 'Mozilla Firefox', 'Microsoft Edge'][Math.floor(Math.random() * 4)],
      deviceType: ['Desktop', 'Mobile', 'Tablet'][Math.floor(Math.random() * 3)],
      amountUSD,
      planDetails: `QuickBooks Enterprise 24.0 (Edition: ${edition}, Override Price: $${amountUSD})`,
      agreedToTerms: true,
      agreedTimestamp: new Date(),
      status: 'Completed',
      fsOrderReference: orderRef,
      fsOrderId: 'MOCK-ID-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      paidAt: new Date(),
      createdAt: new Date(),
    };

    const result = await db.collection('admindata').insertOne(mockRecord);

    return NextResponse.json({ success: true, insertedId: result.insertedId, record: mockRecord });
  } catch (err: any) {
    console.error('[Simulate Payment Error]:', err);
    return NextResponse.json({ error: 'Simulation failed', message: err.message || 'Something went wrong' }, { status: 500 });
  }
}
