import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName, lastName, email, phone, companyName, ein,
      address, city, state, zipCode, country,
      amountUSD, planDetails,
      agreedToTerms, clientSignatureBase64,
      paymentType // 'wire_ach' | 'transaction_id'
    } = body;

    // Extract IP and device info from request headers
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge|opera)[\/\s][\d.]+/i);
    const browser = browserMatch ? browserMatch[0] : userAgent.substring(0, 60) || 'Unknown';

    const { db } = await connectToDatabase();

    const result = await db.collection('admindata').insertOne({
      firstName,
      lastName,
      email,
      phone,
      companyName,
      ein,
      address,
      city,
      state,
      zipCode,
      country,
      amountUSD,
      planDetails,
      status: 'Pending',
      agreedToTerms: agreedToTerms === 'true' || agreedToTerms === true,
      clientSignatureBase64,
      agreedTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentGateway: 'Online Payment',
      paymentType: paymentType || null,   // 'wire_ach' | 'transaction_id'
      paymentProofUrl: null,              // filled by /upload-proof after file upload
      paymentProofType: null,             // 'image' | 'pdf'
      ipAddress,
      deviceType,
      browser,
    });

    const localOrderId = result.insertedId.toString();
    return NextResponse.json({ localOrderId });
  } catch (error: any) {
    console.error('[Online Payment Submit] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
