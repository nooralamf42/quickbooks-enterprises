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

    // Extract IP and device info from request headers
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge|opera)[\/\s][\d.]+/i);
    const browser = browserMatch ? browserMatch[0] : userAgent.substring(0, 60) || 'Unknown';

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
      paymentGateway: 'Stripe',
      ipAddress,
      deviceType,
      browser
    });

    const localOrderId = result.insertedId.toString();

    // Determine the base URL
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = isLocalhost ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com');

    // Create a Stripe Payment Intent for Custom Elements
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUSD * 100),
      currency: 'usd',
      payment_method_types: ['card'],
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
