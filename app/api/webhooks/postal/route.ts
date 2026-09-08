import { NextRequest, NextResponse } from 'next/server';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** Postal's webhook — configured per-server in the Postal dashboard (Settings -> Webhooks),
 *  pointing at this one endpoint for every event type. Postal signs webhook payloads with
 *  RSA (X-Postal-Signature, verified against a public key the server exposes), but that key
 *  isn't wired up here yet — same posture as app/api/webhooks/itwalk: no cryptographic
 *  verification, only trust events whose payload.message.id matches a real logged
 *  providerMessageId (set from the per-recipient id in app/lib/postal.ts's send response).
 *
 *  Payload shape: { event: "MessageSentEvent" | ..., timestamp, payload: { message: { id,
 *  token, ... }, status?, details?, url? (for click events) } }. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  MessageSentEvent: 'sent',
  MessageDelayedEvent: 'delayed',
  MessageDeliveryFailedEvent: 'failed',
  MessageBouncedEvent: 'bounced',
  MessageHeldEvent: 'rejected',
};

interface PostalWebhookPayload {
  event?: string;
  payload?: {
    message?: { id?: number | string };
    status?: string;
    details?: string;
    url?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as PostalWebhookPayload;
    const event = body.event;
    const messageId = body.payload?.message?.id;

    if (!event || messageId === undefined) {
      return NextResponse.json({ ok: true, ignored: 'no event or message id' });
    }

    const providerMessageId = String(messageId);

    if (event === 'MessageLoadedEvent' || event === 'MessageLinkClickedEvent') {
      const kind = event === 'MessageLinkClickedEvent' ? 'clicked' : 'opened';
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, body.payload?.url);
      if (!matched) console.warn(`[Postal Webhook] No log row for ${providerMessageId} (${event})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[event];
    if (!status) {
      return NextResponse.json({ ok: true, ignored: `unrecognized event ${event}` });
    }

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status, body.payload?.details);
    if (!matched) console.warn(`[Postal Webhook] No log row for ${providerMessageId} (${event})`);
    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[Postal Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
