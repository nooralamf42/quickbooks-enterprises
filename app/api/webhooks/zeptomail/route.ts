import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** ZeptoMail delivery/engagement events, so the email log reflects what actually happened
 *  rather than only that ZeptoMail accepted the send. Configure in the Agent's Webhooks tab:
 *  URL https://<your-domain>/api/webhooks/zeptomail, events: hard bounce, soft bounce, open,
 *  click, feedback loop (spam). Set an Authentication Key there and put it in
 *  ZEPTOMAIL_WEBHOOK_AUTH_KEY (not the same as ZEPTOMAIL_API_TOKEN).
 *
 *  Note this endpoint can only receive events once deployed — ZeptoMail cannot reach
 *  localhost. Manual sends only (ZeptoMail is scoped to the Send Email tab, not bulk).
 *  ZeptoMail has no "delivered" event — only negative (bounce/spam) and engagement
 *  (open/click) events, so a row stays 'accepted' unless one of those fires. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'hard bounce': 'bounced',
  'soft bounce': 'delayed',
  'feedback loop': 'complained',
};

/** ZeptoMail signs requests with a `producer-signature` header formatted as
 *  "ts=<millis>;s=<url-encoded base64 HMAC-SHA256>;s-algorithm=HmacSHA256" — the MAC covers
 *  the raw request body alone (not body+timestamp), keyed by the Authentication Key set in
 *  the Agent's Webhooks tab. */
function verifySignature(authKey: string, body: string, header: string): boolean {
  const parts = Object.fromEntries(
    header.split(';').map((p) => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    }),
  );
  const signature = parts.s;
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', authKey).update(body, 'utf8').digest('base64');
  const given = Buffer.from(decodeURIComponent(signature), 'base64');
  const expectedBuf = Buffer.from(expected, 'base64');
  return given.length === expectedBuf.length && crypto.timingSafeEqual(given, expectedBuf);
}

export async function POST(req: NextRequest) {
  try {
    const authKey = process.env.ZEPTOMAIL_WEBHOOK_AUTH_KEY;
    if (!authKey) {
      console.error('[ZeptoMail Webhook] ZEPTOMAIL_WEBHOOK_AUTH_KEY is not configured');
      return NextResponse.json({ error: 'Webhook auth key not configured' }, { status: 500 });
    }

    const signature = req.headers.get('producer-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!verifySignature(authKey, raw, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      event_name?: string; // e.g. "hard bounce", "email opens", "email clicks"
      request_id?: string; // matches the id stored as providerMessageId at send time
      event_message?: { event_data?: { url?: string }[] };
    };

    const providerMessageId = event.request_id;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no request_id' });

    const name = (event.event_name || '').toLowerCase();

    if (name.includes('open') || name.includes('click')) {
      const kind = name.includes('click') ? 'clicked' : 'opened';
      const linkUrl = event.event_message?.event_data?.[0]?.url;
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, linkUrl);
      if (!matched) console.warn(`[ZeptoMail Webhook] No log row for ${providerMessageId} (${event.event_name})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[name];
    if (!status) return NextResponse.json({ ok: true, ignored: event.event_name });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);

    // 200 even when unmatched — the id may belong to a send this app didn't log, and a
    // non-2xx would make ZeptoMail retry an event that can never match.
    if (!matched) console.warn(`[ZeptoMail Webhook] No log row for ${providerMessageId} (${event.event_name})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[ZeptoMail Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
