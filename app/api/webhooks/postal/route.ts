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
 *  Payload shape: { event: "MessageSent" | ..., timestamp, payload: { message: { id, token,
 *  ... }, status?, details?, url? (for click events) } }. Event names match the checkbox
 *  values on the webhook's event-picker form (MessageSent, MessageBounced, etc, no "Event"
 *  suffix) — normalized here in case Postal's actual serialized payload does carry one, since
 *  that wasn't confirmed either way before this shipped. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  MessageSent: 'sent',
  MessageDelayed: 'delayed',
  MessageDeliveryFailed: 'failed',
  MessageBounced: 'bounced',
  MessageHeld: 'rejected',
};

function normalizeEvent(event: string): string {
  return event.endsWith('Event') ? event.slice(0, -'Event'.length) : event;
}

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
    const rawEvent = body.event;
    const messageId = body.payload?.message?.id;

    if (!rawEvent || messageId === undefined) {
      console.warn('[Postal Webhook] No event or message id in payload:', JSON.stringify(body));
      return NextResponse.json({ ok: true, ignored: 'no event or message id' });
    }

    const event = normalizeEvent(rawEvent);
    const providerMessageId = String(messageId);

    if (event === 'MessageLoaded' || event === 'MessageLinkClicked') {
      const kind = event === 'MessageLinkClicked' ? 'clicked' : 'opened';
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, body.payload?.url);
      if (!matched) console.warn(`[Postal Webhook] No log row for ${providerMessageId} (${event})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[event];
    if (!status) {
      console.warn(`[Postal Webhook] Unrecognized event ${rawEvent}:`, JSON.stringify(body));
      return NextResponse.json({ ok: true, ignored: `unrecognized event ${rawEvent}` });
    }

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status, body.payload?.details);
    if (!matched) console.warn(`[Postal Webhook] No log row for ${providerMessageId} (${event})`);
    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[Postal Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
