import { NextResponse } from 'next/server';

/**
 * POST /api/stax/webhook
 *
 * Receives webhook events from Stax Payments.
 * Make sure to configure this URL in the Stax Dashboard and set STAX_WEBHOOK_SECRET in .env.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    // Validate the signature if your webhook requires it (varies by setup)
    // const signature = req.headers.get('x-stax-signature');

    const payload = JSON.parse(rawBody);
    console.log(`[Stax Webhook] Received event: ${payload.event || payload.type}`);

    // Handle different Stax events
    // Usually events are like 'create_transaction', 'update_transaction', etc.
    const eventType = payload.event || payload.type;

    switch (eventType) {
      case 'create_transaction':
        console.log('[Stax Webhook] Transaction created:', payload.data?.id);
        // Add logic to update your database to reflect successful payment
        break;

      case 'update_transaction':
        console.log('[Stax Webhook] Transaction updated:', payload.data?.id, 'Status:', payload.data?.status);
        break;

      default:
        console.log('[Stax Webhook] Unhandled event type:', eventType);
        break;
    }

    // Always respond with 200 OK so Stax knows we received the webhook
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stax Webhook Error]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
