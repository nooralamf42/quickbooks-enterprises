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
 *  Matching a webhook event to a log row: the confirmed payload (from the live "Webhook
 *  Payload" preview in MSG91's Create Webhook form) carries several id-shaped fields —
 *  requestId, uuid, crqid, msgId — and it's not documented which one equals the `unique_id`
 *  our send call stores as providerMessageId (msg91.ts). Rather than guess one, every
 *  candidate is tried in turn against the log collection until one actually matches a row. */

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

/** Every id-shaped field in the payload, in the order to try them — deduplicated and with any
 *  angle brackets (MSG91's docs show msgId rendered that way) stripped. */
function candidateMessageIds(body: Record<string, any>): string[] {
  const raw = [body.requestId, body.msgId, body.uuid, body.crqid, body.outboundEmailId];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v === 'string' && v) {
      const cleaned = v.replace(/^<|>$/g, '');
      if (cleaned) seen.add(cleaned);
    }
  }
  return [...seen];
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

    const candidates = candidateMessageIds(body);
    if (candidates.length === 0) return NextResponse.json({ ok: true, ignored: 'no message id in payload' });

    const eventName = String(body.eventName || '').toLowerCase();

    if (eventName === 'opened' || eventName === 'clicked') {
      const kind = eventName === 'clicked' ? 'clicked' : 'opened';
      const linkUrl = typeof body.url === 'string' ? body.url : undefined;
      let matched = false;
      let matchedId: string | undefined;
      for (const id of candidates) {
        if (await recordEngagementByProviderMessageId(id, kind, linkUrl)) {
          matched = true;
          matchedId = id;
          break;
        }
      }
      if (!matched) console.warn(`[MSG91 Webhook] No log row for any of ${candidates.join(', ')} (${eventName})`);
      return NextResponse.json({ ok: true, matched, matchedId, kind });
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
    let matched = false;
    let matchedId: string | undefined;
    for (const id of candidates) {
      if (await updateDeliveryStatusByProviderMessageId(id, status, detail)) {
        matched = true;
        matchedId = id;
        break;
      }
    }
    if (!matched) console.warn(`[MSG91 Webhook] No log row for any of ${candidates.join(', ')} (${eventName || statusCode})`);

    return NextResponse.json({ ok: true, matched, matchedId, status });
  } catch (err: any) {
    console.error('[MSG91 Webhook] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' });
  }
}
