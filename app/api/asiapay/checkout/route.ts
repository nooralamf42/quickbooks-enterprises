import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      amountUSD, email, firstName, lastName, phone, planDetails, 
      address, city, state, zipCode, country, companyName, ein,
      clientSignatureBase64, agreedToTerms
    } = body;

    const merchantId = process.env.ASIAPAY_MERCHANT_ID;
    const secureHashSecret = process.env.ASIAPAY_HASH_SECRET;
    const payGateUrl = process.env.ASIAPAY_BASE_URL || 'https://test.paydollar.com/b2cDemo/eng/payment/payForm.jsp';

    if (!merchantId || !secureHashSecret) {
      return NextResponse.json({ error: 'AsiaPay credentials are not configured in environment variables' }, { status: 500 });
    }

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
      paymentGateway: 'AsiaPay'
    });

    const localOrderId = result.insertedId.toString();
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = isLocalhost ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com');

    const currCode = '840'; // 840 is USD
    const payType = 'N'; // Normal sale
    const amount = amountUSD.toFixed(2); // e.g. "10.00"

    // Construct SHA-1 hash
    // The format is: merchantId|orderRef|currCode|amount|payType|secureHashSecret
    const rawHashString = `${merchantId}|${localOrderId}|${currCode}|${amount}|${payType}|${secureHashSecret}`;
    const secureHash = crypto.createHash('sha1').update(rawHashString).digest('hex');

    const redirectParams = {
      merchantId,
      orderRef: localOrderId,
      amount,
      currCode,
      payType,
      secureHash,
      successUrl: `${base}/payment-success?order_id=${localOrderId}`,
      failUrl: `${base}/order-summary?token=error`,
      cancelUrl: `${base}/order-summary?token=cancel`,
      payGateUrl
    };

    return NextResponse.json(redirectParams);
  } catch (error: any) {
    console.error('AsiaPay Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
