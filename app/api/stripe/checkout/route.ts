import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/app/lib/mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      amountUSD, email, firstName, lastName, phone, planDetails, 
      address, city, state, zipCode, country, companyName, ein,
      clientSignatureBase64, agreedToTerms
    } = body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe API key is not configured' }, { status: 500 });
    }

    const { db } = await connectToDatabase();
    
    // Create a pending order log in MongoDB (same as Authorize.net / Whop)
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
      paymentGateway: 'Stripe'
    });

    const localOrderId = result.insertedId.toString();

    // Determine the base URL
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = isLocalhost ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com');

    // Create a Stripe Payment Intent for Custom Elements
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUSD * 100),
      currency: 'usd',
      receipt_email: email,
      description: planDetails ? `License subscription - ${planDetails}` : `License subscription - ${companyName || 'B2B Client'}`,
      metadata: {
        localOrderId
      }
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, localOrderId });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
