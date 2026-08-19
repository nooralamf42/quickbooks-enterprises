import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { createCashierPayment } from '@/app/lib/antom';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amountUSD, email, firstName, lastName, phone, planDetails,
      address, city, state, zipCode, country, companyName, ein,
      clientSignatureBase64, agreedToTerms
    } = body;

    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge|opera)[\/\s][\d.]+/i);
    const browser = browserMatch ? browserMatch[0] : userAgent.substring(0, 60) || 'Unknown';

    const { db } = await connectToDatabase();

    const result = await db.collection('admindata').insertOne({
      firstName, lastName, email, phone, companyName, ein,
      address, city, state, zipCode, country,
      amountUSD, planDetails,
      status: 'Pending',
      agreedToTerms: agreedToTerms === 'true' || agreedToTerms === true,
      clientSignatureBase64,
      agreedTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentGateway: 'Antom',
      ipAddress,
      deviceType,
      browser
    });

    const localOrderId = result.insertedId.toString();
    const base = process.env.NEXT_PUBLIC_BASE_URL_OVERRIDE || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const antomRes = await createCashierPayment({
      paymentRequestId: localOrderId,
      amountUSD: Number(amountUSD),
      orderDescription: planDetails || 'QuickBooks Enterprise',
      buyerEmail: email,
      paymentRedirectUrl: `${base}/payment-success?order_id=${localOrderId}&gateway=antom`,
      paymentNotifyUrl: process.env.ANTOM_NOTIFY_URL || undefined,
    });

    if (!antomRes.ok || antomRes.data?.result?.resultStatus === 'F') {
      console.error('[Antom Checkout] pay API failed:', antomRes.data);
      return NextResponse.json({ error: antomRes.data?.result?.resultMessage || 'Antom payment initiation failed' }, { status: 502 });
    }

    const redirectUrl = antomRes.data?.normalUrl;
    if (!redirectUrl) {
      console.error('[Antom Checkout] No redirect URL in response:', antomRes.data);
      return NextResponse.json({ error: 'Antom did not return a checkout URL' }, { status: 502 });
    }

    await db.collection('admindata').updateOne(
      { _id: result.insertedId },
      { $set: { antomPaymentId: antomRes.data.paymentId, updatedAt: new Date() } }
    );

    return NextResponse.json({ redirectUrl, localOrderId });
  } catch (error: any) {
    console.error('Antom Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
