import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

function parseUserAgent(ua: string | null) {
  if (!ua) return { browser: 'Unknown', device: 'Desktop' };

  let device = 'Desktop';
  if (/mobi|android|iphone|ipad|ipod/i.test(ua)) {
    device = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  let browser = 'Unknown';
  if (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) browser = 'Google Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios|edge|edg|opr/i.test(ua)) browser = 'Apple Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';
  else if (/trident|msie/i.test(ua)) browser = 'Internet Explorer';

  return { browser, device };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, companyName,
      address, city, state, zipCode, country,
      amountUSD, planDetails,
    } = body;

    let ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (ipAddress.includes(',')) ipAddress = ipAddress.split(',')[0].trim();

    const { browser, device } = parseUserAgent(req.headers.get('user-agent'));

    const { db } = await connectToDatabase();

    const result = await db.collection('admindata').insertOne({
      email: email || '',
      firstName: firstName || '',
      lastName: lastName || '',
      companyName: companyName || '',
      phone: phone || '',
      address: address || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      country: country || 'US',
      ipAddress,
      browser,
      deviceType: device,
      amountUSD: parseFloat(String(amountUSD || 0)),
      planDetails: planDetails || 'QuickBooks Enterprise Subscription',
      agreedToTerms: true,
      agreedTimestamp: new Date(),
      status: 'Pending',
      fsOrderReference: '',
      fsOrderId: '',
      gateway: 'Stax',
      paidAt: null,
      createdAt: new Date(),
    });

    return NextResponse.json({ localOrderId: result.insertedId.toString() });
  } catch (err: any) {
    console.error('[Stax start-payment]', err);
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 });
  }
}
