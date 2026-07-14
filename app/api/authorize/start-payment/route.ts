import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      amountUSD, email, firstName, lastName, phone, planDetails, 
      address, city, state, zipCode, country, companyName, ein, gateway,
      clientSignatureBase64
    } = body;

    const { db } = await connectToDatabase();
    
    // Create a pending order in MongoDB
    const result = await db.collection('admindata').insertOne({
      firstName, lastName, email, phone, companyName, ein,
      address, city, state, zipCode, country,
      amountUSD, planDetails,
      status: 'Pending',
      agreedToTerms: body.agreedToTerms === 'true' || body.agreedToTerms === true,
      clientSignatureBase64,
      agreedTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentGateway: gateway || 'Authorize.net'
    });

    const localOrderId = result.insertedId.toString();

    return NextResponse.json({ localOrderId });
  } catch (error: any) {
    console.error('Start Payment Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
