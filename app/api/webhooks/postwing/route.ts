import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** Postwing delivery/engagement events, so the email log reflects what actually happened
 *  rather than only that Postwing accepted the send. Configure in the domain dashboard under
 *  Webhooks -> Endpoints, pointing to https://<your-domain>/api/webhooks/postwing, events:
 *  delivered, bounced, deferred, complained, dropped (opened/clicked need tracking enabled).
 *
 *  Note this endpoint can only receive events once deployed — Postwing cannot reach
 *  localhost. Manual sends only (Postwing is scoped to the Send Email tab, not bulk). */

/** Reject events older than this to blunt replay attempts — Postwing's own docs recommend
 *  a ~300 second tolerance. */
const TOLERANCE_SECONDS = 300;

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  delivered: 'delivered',
  bounced: 'bounced',
  deferred: 'delayed',
  complained: 'complained',
  dropped: 'rejected',
};

/** Postwing signs "{timestamp}.{raw_body}" with HMAC-SHA256, keyed by the whsec_… signing
 *  secret shown once when the webhook endpoint is created, sent as a lowercase hex digest
 *  in the X-Webhook-Signature header alongside X-Webhook-Timestamp. */
function verifySignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  const given = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  return given.length === expectedBuf.length && crypto.timingSafeEqual(given, expectedBuf);
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.POSTWING_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Postwing Webhook] POSTWING_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!isFinite(age) || age > TOLERANCE_SECONDS) {
      return NextResponse.json({ error: 'Timestamp outside tolerance' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!verifySignature(secret, timestamp, raw, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      event?: string; // e.g. "delivered", "bounced", "opened"
      message_id?: string; // matches the id stored as providerMessageId at send time
      data?: { url?: string };
    };

    const providerMessageId = event.message_id;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no message_id' });

    // Opens/clicks are engagement, not delivery — recorded separately so they never
    // clobber a terminal deliveryStatus like 'delivered' or 'bounced'.
    if (event.event === 'opened' || event.event === 'clicked') {
      const kind = event.event === 'clicked' ? 'clicked' : 'opened';
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, event.data?.url);
      if (!matched) console.warn(`[Postwing Webhook] No log row for ${providerMessageId} (${event.event})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[event.event ?? ''];
    if (!status) return NextResponse.json({ ok: true, ignored: event.event });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);

    // 200 even when unmatched — the id may belong to a send this app didn't log, and a
    // non-2xx would make Postwing retry an event that can never match.
    if (!matched) console.warn(`[Postwing Webhook] No log row for ${providerMessageId} (${event.event})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[Postwing Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
