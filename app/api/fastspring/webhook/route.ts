import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/app/lib/mongodb';

/**
 * POST /api/fastspring/webhook
 *
 * Receives order lifecycle events from FastSpring.
 * Configure this URL in FastSpring Dashboard → Integrations → Webhooks
 *
 * Docs: https://developer.fastspring.com/docs/webhooks
 *
 * Common events:
 *  - order.completed       → New one-time purchase fulfilled
 *  - subscription.activated → New subscription started
 *  - subscription.canceled  → Subscription cancelled
 *  - refund.created        → Refund issued
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Signature Verification ────────────────────────────────────────────────
    // FastSpring signs webhook payloads with HMAC-SHA256
    // Set FASTSPRING_WEBHOOK_SECRET in .env (from FastSpring dashboard)
    const secret = process.env.FASTSPRING_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get('x-fastspring-signature');
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
      }
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      if (signature !== expectedSig) {
        console.warn('[FastSpring Webhook] Invalid signature — request rejected');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody);
    const events = payload?.events ?? [];

    console.log(`[FastSpring Webhook] Received ${events.length} event(s)`);

    for (const event of events) {
      const { type, data } = event;
      console.log(`[FastSpring Webhook] Processing event: ${type}`, data?.reference);

      switch (type) {
        // ── One-time Purchase ───────────────────────────────────────────────
        case 'order.completed': {
          const order = data;
          console.log('[FastSpring] Order completed:', {
            reference: order?.reference,
            email: order?.customer?.email,
            total: order?.total,
            currency: order?.currency,
            items: order?.items?.map((i: any) => i?.product),
          });
          
          // Save completed compliance log to MongoDB admindata collection
          try {
            const { db } = await connectToDatabase();
            const tags = order?.tags || {};

            const logRecord = {
              email: tags.email || order?.customer?.email || '',
              firstName: tags.firstName || order?.customer?.firstName || '',
              lastName: tags.lastName || order?.customer?.lastName || '',
              companyName: tags.companyName || order?.customer?.company || '',
              phone: tags.phone || order?.customer?.phone || '',
              address: tags.address || order?.customer?.address?.addressLine1 || '',
              city: tags.city || order?.customer?.address?.city || '',
              state: tags.state || order?.customer?.address?.region || '',
              zipCode: tags.zipCode || order?.customer?.address?.postalCode || '',
              country: tags.country || order?.customer?.address?.country || 'US',
              ipAddress: tags.ipAddress || order?.ip || '127.0.0.1',
              browser: tags.browser || 'Unknown',
              deviceType: tags.deviceType || 'Desktop',
              amountUSD: parseFloat(tags.amountUSD || order?.total || '0'),
              planDetails: tags.planDetails || `QuickBooks Enterprise (Order Ref: ${order?.reference})`,
              agreedToTerms: tags.agreedToTerms === 'true' || true,
              agreedTimestamp: tags.agreedTimestamp ? new Date(tags.agreedTimestamp) : new Date(),
              status: 'Completed',
              fsOrderReference: order?.reference || '',
              fsOrderId: order?.id || '',
              paidAt: new Date(),
              createdAt: new Date(),
            };

            const result = await db.collection('admindata').insertOne(logRecord);
            console.log('[MongoDB Webhook] Successfully logged completed payment to admindata:', result.insertedId);
          } catch (dbErr) {
            console.error('[MongoDB Webhook] Failed to save compliance log to database:', dbErr);
          }
          break;
        }

        // ── Subscription Events ─────────────────────────────────────────────
        case 'subscription.activated': {
          const sub = data;
          console.log('[FastSpring] Subscription activated:', {
            id: sub?.id,
            email: sub?.customer?.email,
            product: sub?.product,
          });
          // TODO: Grant subscription access in your system
          break;
        }

        case 'subscription.deactivated':
        case 'subscription.canceled': {
          const sub = data;
          console.log(`[FastSpring] Subscription ${type}:`, sub?.id);
          // TODO: Revoke subscription access
          break;
        }

        case 'subscription.charge.failed': {
          const sub = data;
          console.log('[FastSpring] Subscription charge failed:', sub?.id);
          // TODO: Send payment failure notification to customer
          break;
        }

        // ── Refunds ─────────────────────────────────────────────────────────
        case 'refund.created': {
          const refund = data;
          console.log('[FastSpring] Refund issued:', {
            order: refund?.order,
            amount: refund?.total,
          });
          // TODO: Revoke access / process refund in your system
          break;
        }

        default:
          console.log(`[FastSpring Webhook] Unhandled event type: ${type}`);
      }
    }

    return NextResponse.json({ received: true, processed: events.length });
  } catch (err: any) {
    console.error('[FastSpring Webhook] Error:', err);
    return NextResponse.json(
      { error: 'Webhook processing error', message: err.message },
      { status: 500 }
    );
  }
}
