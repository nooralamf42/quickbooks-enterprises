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
            },
            // Clears any earlier failed-attempt trail on this order now that it's succeeded —
            // a customer who fails once then retries and pays shouldn't still show a failure.
            $unset: { failureReason: '', failedAt: '' }
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
    } else if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      // A declined card, an abandoned 3DS challenge, or an explicit cancel — every one of
      // these previously left the order silently stuck as "Pending" forever with no record
      // of what happened. last_payment_error carries the decline reason for failed events;
      // canceled events don't have one, so cancellation_reason (or a generic fallback) is
      // used instead.
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const localOrderId = paymentIntent.metadata?.localOrderId;

      if (localOrderId) {
        const reason = event.type === 'payment_intent.payment_failed'
          ? paymentIntent.last_payment_error?.message || 'Card declined'
          : `Payment canceled${paymentIntent.cancellation_reason ? ` (${paymentIntent.cancellation_reason})` : ''}`;

        console.log(`[Stripe Webhook] Marking order ${localOrderId} Failed: ${reason}`);

        const { db } = await connectToDatabase();
        const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

        // Never downgrade an order that's already Completed — a late/duplicate failure
        // event for a payment intent that ultimately succeeded shouldn't undo that.
        if (record && record.status !== 'Completed') {
          await db.collection('admindata').updateOne(
            { _id: new ObjectId(localOrderId) },
            {
              $set: {
                status: 'Failed',
                stripePaymentIntentId: paymentIntent.id,
                failureReason: reason,
                failedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', details: error.message }, { status: 500 });
  }
}
