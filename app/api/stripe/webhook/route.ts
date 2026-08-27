import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPaymentNotificationEmail } from '@/app/lib/paymentNotification';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error(`Webhook Signature verification failed:`, err.message);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const localOrderId = paymentIntent.metadata?.localOrderId;

      if (localOrderId) {
        console.log(`[Stripe Webhook] Completing order ${localOrderId}`);

        const { db } = await connectToDatabase();
        const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

        const updateRes = await db.collection('admindata').updateOne(
          { _id: new ObjectId(localOrderId) },
          {
            $set: {
              status: 'Completed',
              stripePaymentIntentId: paymentIntent.id,
              paidAt: new Date(),
              updatedAt: new Date()
            }
          }
        );

        console.log(`[Stripe Webhook] MongoDB update results:`, updateRes.modifiedCount);

        if (record && record.status !== 'Completed') {
          await sendPaymentNotificationEmail({
            gatewayLabel: 'Stripe',
            customerName: `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unknown',
            email: record.email,
            phone: record.phone,
            companyName: record.companyName,
            address: record.address,
            city: record.city,
            state: record.state,
            zipCode: record.zipCode,
            country: record.country,
            planDetails: record.planDetails,
            amountUSD: record.amountUSD ?? paymentIntent.amount / 100,
            transactionId: paymentIntent.id,
            transactionIdLabel: 'Payment Intent ID',
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
