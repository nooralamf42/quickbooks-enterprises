import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyMorSignature } from '@/app/lib/mor';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // The docs example uses "Mor-Signature", but the live dashboard (Checkout settings)
    // says the secret is sent as "X-MOR-Signature" — accept either header name.
    const signature = req.headers.get('mor-signature') || req.headers.get('x-mor-signature') || '';
    const timestamp = req.headers.get('mor-timestamp') || req.headers.get('x-mor-timestamp') || '';
    const deliveryId = req.headers.get('mor-delivery-id') || req.headers.get('x-mor-delivery-id') || '';
    const eventType = req.headers.get('mor-event-type') || req.headers.get('x-mor-event-type') || '';

    const secret = process.env.MOR_WEBHOOK_SECRET || '';
    if (!secret || !verifyMorSignature(rawBody, signature, timestamp, secret)) {
      console.error('[MOR Webhook] Invalid signature, rejecting');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Reject stale/replayed deliveries — the timestamp is inside the signed material.
    const timestampSec = Number(timestamp);
    if (!timestampSec || Math.abs(Date.now() / 1000 - timestampSec) > 300) {
      console.error('[MOR Webhook] Stale or missing timestamp, rejecting');
      return NextResponse.json({ error: 'Stale timestamp' }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    // Idempotency: MOR.AI retries until we ack 2xx, so the same Mor-Delivery-Id can arrive
    // more than once. Record it once and skip reprocessing on repeats.
    if (deliveryId) {
      const existing = await db.collection('morWebhookDeliveries').findOne({ deliveryId });
      if (existing) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      await db.collection('morWebhookDeliveries').insertOne({ deliveryId, eventType, receivedAt: new Date() });
    }

    const payload = JSON.parse(rawBody);
    const localOrderId = payload.reference;

    if (!localOrderId || !ObjectId.isValid(localOrderId)) {
      console.warn('[MOR Webhook] No valid reference in payload:', payload.reference);
      return NextResponse.json({ received: true });
    }

    const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });
    if (!record) {
      console.warn('[MOR Webhook] Order not found:', localOrderId);
      return NextResponse.json({ received: true });
    }

    const type = payload.type || eventType;

    if (type === 'payment.succeeded') {
      if (record.status !== 'Completed') {
        await db.collection('admindata').updateOne(
          { _id: new ObjectId(localOrderId) },
          {
            $set: {
              status: 'Completed',
              fsOrderReference: `MOR-${payload.payment_id}`,
              fsOrderId: payload.payment_id,
              gateway: 'MOR',
              paidAt: new Date(),
              amountUSD: payload.amount ? payload.amount / 100 : record.amountUSD,
              updatedAt: new Date(),
            },
            $unset: { failureReason: '', failedAt: '' },
          }
        );
        console.log('[MOR Webhook] Order marked Completed:', localOrderId);
      }
    } else if (type === 'payment.failed') {
      if (record.status !== 'Completed') {
        await db.collection('admindata').updateOne(
          { _id: new ObjectId(localOrderId) },
          {
            $set: {
              status: 'Failed',
              morPaymentId: payload.payment_id,
              failureReason: 'Card declined or payment abandoned',
              failedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );
        console.log('[MOR Webhook] Order marked Failed:', localOrderId);
      }
    } else if (type === 'payment.refunded') {
      await db.collection('admindata').updateOne(
        { _id: new ObjectId(localOrderId) },
        {
          $set: {
            status: 'Refunded',
            refundedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      console.log('[MOR Webhook] Order marked Refunded:', localOrderId);
    } else if (type === 'refund.succeeded' || type === 'refund.failed') {
      console.log(`[MOR Webhook] ${type} for order ${localOrderId}, refund ${payload.id}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[MOR Webhook Error]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
