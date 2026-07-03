import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amountUSD, email, firstName, lastName, phone, planDetails, address, city, state, zipCode, country } = body;

    const apiKey = process.env.WHOP_API_KEY;
    const companyId = process.env.WHOP_COMPANY_ID;
    const productId = process.env.WHOP_PRODUCT_ID;

    if (!apiKey || !companyId || !productId) {
      return NextResponse.json({ error: 'Whop credentials not configured' }, { status: 500 });
    }

    let localOrderId = '';
    try {
      const { db } = await connectToDatabase();
      const result = await db.collection('admindata').insertOne({
        firstName, lastName, email, phone,
        address, city, state, zipCode, country,
        amountUSD, planDetails,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentGateway: 'Whop'
      });
      localOrderId = result.insertedId.toString();
    } catch (e) {
      console.error('Failed to insert order', e);
    }

    // Create checkout configuration
    const res = await fetch('https://api.whop.com/api/v1/checkout_configurations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        mode: 'payment',
        plan: {
          initial_price: amountUSD,
          plan_type: 'one_time',
          company_id: companyId,
          currency: 'usd',
          product_id: productId,
        },
        metadata: {
          localOrderId
        }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Whop checkout error:', errorText);
      return NextResponse.json({ error: 'Failed to create Whop checkout session', details: errorText }, { status: res.status });
    }

    const data = await res.json();
    
    // Whop API might return data.id or data.checkout_configuration.id
    const sessionId = data.id || data.checkout_configuration?.id || data.session_id || data.checkout_session?.id;

    return NextResponse.json({ sessionId, localOrderId, rawData: data });
  } catch (error: any) {
    console.error('Whop API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
