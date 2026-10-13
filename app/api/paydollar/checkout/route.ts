import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { getPaydollarConfig, buildPaydollarCheckoutForm } from '@/app/lib/paydollar';

export async function POST(req: Request) {
  try {
    const cfg = getPaydollarConfig();
    if (!cfg) {
      console.error('[PayDollar Checkout] PAYDOLLAR_MERCHANT_ID is not configured');
      return NextResponse.json({ error: 'PayDollar is not available right now.' }, { status: 503 });
    }

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
      paymentGateway: 'PayDollar',
      ipAddress,
      deviceType,
      browser
    });

    const localOrderId = result.insertedId.toString();
    const base = process.env.NEXT_PUBLIC_BASE_URL_OVERRIDE || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const { formAction, fields } = buildPaydollarCheckoutForm(cfg, {
      orderRef: localOrderId,
      amountUSD: Number(amountUSD),
      // "For display purpose only. DO NOT use this URL to update your system" per the integration
      // guide — the Data Feed webhook and the Query API sync fallback are the sources of truth.
      successUrl: `${base}/payment-success?order_id=${localOrderId}&gateway=paydollar&outcome=success`,
      failUrl: `${base}/payment-success?order_id=${localOrderId}&gateway=paydollar&outcome=fail`,
      cancelUrl: `${base}/payment-success?order_id=${localOrderId}&gateway=paydollar&outcome=cancel`,
      remark: planDetails,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: email,
      billingAddress1: address,
      billingCity: city,
      billingState: state,
      billingPostalCode: zipCode,
      billingCountry: country,
    });

    return NextResponse.json({ formAction, fields, localOrderId });
  } catch (error: any) {
    console.error('PayDollar Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
