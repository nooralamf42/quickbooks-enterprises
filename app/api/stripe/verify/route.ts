import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: Request) {
  try {
    const { payment_intent, order_id } = await req.json();

    if (!payment_intent || !order_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Retrieve the payment intent from Stripe to verify it actually succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);

    if (paymentIntent.status === 'succeeded') {
      const { db } = await connectToDatabase();
      
      // Update the order in the database
      const updateRes = await db.collection('admindata').updateOne(
        { _id: new ObjectId(order_id) },
        {
          $set: {
            status: 'Completed',
            stripePaymentIntentId: paymentIntent.id,
            paidAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return NextResponse.json({ success: true, status: 'Completed', modified: updateRes.modifiedCount });
    }

    return NextResponse.json({ success: false, status: paymentIntent.status });
  } catch (error: any) {
    console.error('Stripe Verification Error:', error);
    return NextResponse.json({ error: 'Verification failed', details: error.message }, { status: 500 });
  }
}
