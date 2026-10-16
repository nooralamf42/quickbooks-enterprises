import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** MSG91 delivery/engagement events, so the email log reflects what actually happened rather
 *  than only that MSG91 accepted the send. MSG91 requires a SEPARATE webhook per event
 *  category (Dashboard > Email > Webhook (New) > Create Webhook) — all pointing at this same
 *  URL: one for "On Report Received" (delivery status), one for "On Opened, Unsubscribed,
 *  Clicked, Complaints Received" (engagement). "On Enqueued" isn't needed — logEmailSent()
 *  already records the send itself at call time.
 *
 *  Auth: MSG91's webhook form lets you attach custom key-value headers sent with every
 *  report — same scheme as ZeptoMail/MailPace in this codebase. Set MSG91_WEBHOOK_SECRET and
 *  add a header here named X-Webhook-Secret with that value in both of the webhooks above.
 *
 *  Matching a webhook event to a log row: MSG91's docs describe msgId as "a unique ID MSG91
 *  generates for each email request" but don't confirm it's the literal same string as the
 *  `unique_id` our send call stores as providerMessageId (msg91.ts) — the docs even show it
 *  rendered in angle brackets, which may just be display formatting or may mean a different
 *  shape entirely. Checks a few plausible field names defensively; if none match real
 *  payloads, re-check against a live webhook delivery and adjust. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  delivered: 'delivered',
  bounced: 'bounced',
  softbounce: 'delayed',
  blocked: 'rejected',
  deferred: 'delayed',
};

function verifySecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractMessageId(body: Record<string, any>): string | undefined {
  const candidate = body.msgId || body.msg_id || body.requestId || body.request_id || body.uuid || body.crqid;
  if (typeof candidate === 'string' && candidate) {
    // Docs show msgId rendered in angle brackets in their sample — strip them if present.
    return candidate.replace(/^<|>$/g, '');
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.MSG91_WEBHOOK_SECRET;
    const receivedSecret = req.headers.get('x-webhook-secret');
    const authenticated = !!expectedSecret && !!receivedSecret && verifySecret(expectedSecret, receivedSecret);

    if (!expectedSecret) console.error('[MSG91 Webhook] MSG91_WEBHOOK_SECRET is not configured');
    else if (receivedSecret && !authenticated) console.warn('[MSG91 Webhook] Rejected request with a non-matching secret');

    const raw = await req.text();
    if (!raw.trim()) return NextResponse.json({ ok: true });

    let body: Record<string, any>;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: true, ignored: 'non-JSON body' });
    }

    if (!authenticated) return NextResponse.json({ ok: true, authenticated: false });

    const providerMessageId = extractMessageId(body);
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no message id in payload' });

    const eventName = String(body.eventName || '').toLowerCase();

    if (eventName === 'opened' || eventName === 'clicked') {
      const kind = eventName === 'clicked' ? 'clicked' : 'opened';
      const linkUrl = typeof body.url === 'string' ? body.url : undefined;
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, linkUrl);
      if (!matched) console.warn(`[MSG91 Webhook] No log row for ${providerMessageId} (${eventName})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    // "Report Received" delivery events carry an SMTP-style statusCode rather than a named
    // event — 2xx is a successful delivery, 4xx a temporary/soft failure, 5xx a hard failure.
    const statusCode = String(body.statusCode || '');
    let status: DeliveryStatus | undefined = EVENT_STATUS[eventName];
    if (!status && statusCode) {
      status = statusCode.startsWith('2') ? 'delivered'
        : statusCode.startsWith('4') ? 'delayed'
        : statusCode.startsWith('5') ? 'bounced'
        : undefined;
    }
    if (eventName === 'complaints' || eventName === 'complaint') status = 'complained';

    if (!status) return NextResponse.json({ ok: true, ignored: eventName || statusCode || 'unrecognized event' });

    const detail = typeof body.reason === 'string' ? body.reason : undefined;
    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status, detail);
    if (!matched) console.warn(`[MSG91 Webhook] No log row for ${providerMessageId} (${eventName || statusCode})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[MSG91 Webhook] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' });
  }
}
