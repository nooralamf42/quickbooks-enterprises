import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** ZeptoMail delivery/engagement events, so the email log reflects what actually happened
 *  rather than only that ZeptoMail accepted the send. Configured in the Agent's Webhooks tab
 *  with URL https://<your-domain>/api/webhooks/zeptomail, events: Delivered, Hard bounces,
 *  Soft bounces, Feedback loop (opens/clicks need "Enable tracking" turned on separately,
 *  and aren't checkboxes here at all).
 *
 *  Auth is a simple custom header ("Authorization headers" in the Add Webhook form) — NOT
 *  the HMAC producer-signature scheme ZeptoMail's own docs describe elsewhere. The actual
 *  form only exposes a header name/value pair that gets echoed back verbatim on every call,
 *  checked here with a constant-time comparison. Header name is fixed to X-Webhook-Secret;
 *  change both here and in the dashboard together if that ever needs to differ.
 *
 *  Event type lives at event_data[0].object (e.g. "softbounce", "hardbounce", "delivered"),
 *  confirmed from ZeptoMail's own live payload preview — not a top-level event_name field
 *  the way the docs described. Manual sends only (ZeptoMail is scoped to the Send Email tab,
 *  not bulk). Note this endpoint can only receive events once deployed — ZeptoMail cannot
 *  reach localhost. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  delivered: 'delivered',
  hardbounce: 'bounced',
  softbounce: 'delayed',
  feedbackloop: 'complained',
  spamcomplaint: 'complained',
};

function verifySecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The Add Webhook form's own "API call should be unauthenticated" note, combined with the
// "URL cannot be reached" error seen on a working, deployed URL, means ZeptoMail's own
// "Verify" click doesn't send the configured header at all — likely a bare reachability
// check. So a missing header returns a plain 200 (verification / anything we can't trust)
// instead of 401; only a header that's PRESENT but WRONG is treated as tampering.
export async function GET() {
  return NextResponse.json({ ok: true });
}

// The Add Webhook form is explicit: "All API calls should return status code 200" — so
// every response below is a 200 regardless of outcome, with success/failure conveyed in the
// JSON body instead of the HTTP status. Returning anything else (401, 500) is what made
// ZeptoMail's own setup flow report "URL cannot be reached" even though the endpoint was live.
export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.ZEPTOMAIL_WEBHOOK_SECRET;
    const receivedSecret = req.headers.get('x-webhook-secret');
    const authenticated = !!expectedSecret && !!receivedSecret && verifySecret(expectedSecret, receivedSecret);

    if (!expectedSecret) console.error('[ZeptoMail Webhook] ZEPTOMAIL_WEBHOOK_SECRET is not configured');
    else if (receivedSecret && !authenticated) console.warn('[ZeptoMail Webhook] Rejected request with a non-matching secret');

    const raw = await req.text();
    if (!raw.trim()) return NextResponse.json({ ok: true });

    let body: {
      request_id?: string; // matches the id stored as providerMessageId at send time
      event_data?: { object?: string; details?: { url?: string }[] }[];
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: true, ignored: 'non-JSON body' });
    }

    // Never apply an unauthenticated (or wrongly-authenticated) payload's contents — only a
    // verification-style no-header ping gets a plain pass-through, and it has nothing to act
    // on anyway.
    if (!authenticated) return NextResponse.json({ ok: true, authenticated: false });

    const providerMessageId = body.request_id;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no request_id' });

    const eventObject = (body.event_data?.[0]?.object || '').toLowerCase();

    if (eventObject.includes('open') || eventObject.includes('click')) {
      const kind = eventObject.includes('click') ? 'clicked' : 'opened';
      const linkUrl = body.event_data?.[0]?.details?.[0]?.url;
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, linkUrl);
      if (!matched) console.warn(`[ZeptoMail Webhook] No log row for ${providerMessageId} (${eventObject})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[eventObject];
    if (!status) return NextResponse.json({ ok: true, ignored: eventObject });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);
    if (!matched) console.warn(`[ZeptoMail Webhook] No log row for ${providerMessageId} (${eventObject})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[ZeptoMail Webhook] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' });
  }
}
