import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { createMorPayment } from '@/app/lib/mor';

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
      paymentGateway: 'MOR',
      ipAddress,
      deviceType,
      browser
    });

    const localOrderId = result.insertedId.toString();
    const base = process.env.NEXT_PUBLIC_BASE_URL_OVERRIDE || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const morRes = await createMorPayment({
      amountUSD: Number(amountUSD),
      reference: localOrderId,
      returnUrl: `${base}/payment-success?order_id=${localOrderId}&gateway=mor`,
      callbackUrl: process.env.MOR_NOTIFY_URL || undefined,
      description: planDetails || 'QuickBooks Enterprise',
      idempotencyKey: `${localOrderId}-attempt-1`,
      customer: {
        email,
        phone,
        address_line1: address,
        city,
        state,
        postal_code: zipCode,
        country,
      },
    });

    if (!morRes.ok || !morRes.data?.checkout_url) {
      console.error('[MOR Checkout] payment creation failed:', morRes.data);
      const errData = morRes.data as any;
      return NextResponse.json({ error: errData?.error?.message || 'MOR.AI payment initiation failed' }, { status: 502 });
    }

    await db.collection('admindata').updateOne(
      { _id: result.insertedId },
      { $set: { morPaymentId: morRes.data.id, updatedAt: new Date() } }
    );

    return NextResponse.json({ checkoutUrl: morRes.data.checkout_url, localOrderId });
  } catch (error: any) {
    console.error('MOR Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
