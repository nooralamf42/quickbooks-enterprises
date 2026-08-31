import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** Maileroo delivery/engagement events, so the email log reflects what actually happened
 *  rather than only that Maileroo accepted the send. Configure under Domain -> Webhooks,
 *  pointing to https://<your-domain>/api/webhooks/maileroo, events: delivered, bounced,
 *  soft_bounced, complained, opened, clicked.
 *
 *  Maileroo signs the raw payload body with HMAC-SHA256 keyed by the webhook's shared
 *  secret, sent as a hex digest in the X-Maileroo-Signature header — no timestamp involved,
 *  unlike Postwing's scheme. Manual sends only (Maileroo is scoped to the Send Email tab,
 *  not bulk). This endpoint can only receive events once deployed — Maileroo cannot reach
 *  localhost. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  delivered: 'delivered',
  bounced: 'bounced',
  soft_bounced: 'delayed',
  complained: 'complained',
};

function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const given = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  return given.length === expectedBuf.length && crypto.timingSafeEqual(given, expectedBuf);
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MAILEROO_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Maileroo Webhook] MAILEROO_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const signature = req.headers.get('x-maileroo-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!verifySignature(secret, raw, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      event_type?: string; // e.g. "delivered", "bounced", "opened", "clicked"
      message_reference_id?: string; // matches the id stored as providerMessageId at send time
      event_data?: { url?: string };
    };

    const providerMessageId = event.message_reference_id;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no message_reference_id' });

    // Opens/clicks are engagement, not delivery — recorded separately so they never
    // clobber a terminal deliveryStatus like 'delivered' or 'bounced'.
    if (event.event_type === 'opened' || event.event_type === 'clicked') {
      const kind = event.event_type === 'clicked' ? 'clicked' : 'opened';
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, event.event_data?.url);
      if (!matched) console.warn(`[Maileroo Webhook] No log row for ${providerMessageId} (${event.event_type})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[event.event_type ?? ''];
    if (!status) return NextResponse.json({ ok: true, ignored: event.event_type });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);

    // 200 even when unmatched — the id may belong to a send this app didn't log, and a
    // non-2xx would make Maileroo retry an event that can never match.
    if (!matched) console.warn(`[Maileroo Webhook] No log row for ${providerMessageId} (${event.event_type})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[Maileroo Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
