import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** MailerSend delivery events, so the email log reflects what actually happened rather than
 *  only that MailerSend accepted the send. Configure in the MailerSend dashboard under
 *  Webhooks, pointing to https://<your-domain>/api/webhooks/mailersend, and put the signing
 *  secret shown there (not the API token) into MAILERSEND_WEBHOOK_SECRET.
 *
 *  Note this endpoint can only receive events once deployed — MailerSend cannot reach
 *  localhost. Manual sends only (MailerSend is scoped to the Send Email tab, not bulk). */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  soft_bounced: 'delayed',
  hard_bounced: 'bounced',
  spam_complaint: 'complained',
};

/** MailerSend signs the raw request body with HMAC-SHA256, sent hex-encoded in the
 *  `Signature` header — no svix-style id/timestamp wrapper the way Resend's is. */
function verifySignature(secret: string, body: string, header: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const given = Buffer.from(header, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  return given.length === expectedBuf.length && crypto.timingSafeEqual(given, expectedBuf);
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MAILERSEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[MailerSend Webhook] MAILERSEND_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const signature = req.headers.get('signature') || req.headers.get('Signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!verifySignature(secret, raw, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      type?: string; // e.g. "activity.delivered"
      data?: {
        message_id?: string;
        email_id?: string;
        meta?: { url?: string; click?: { url?: string } };
      };
    };

    // message_id is the id returned in the x-message-id header at send time (what we store
    // as providerMessageId); email_id is a per-recipient sub-id — fall back to it in case a
    // given event only carries that one.
    const providerMessageId = event.data?.message_id || event.data?.email_id;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no message_id' });

    const kind = event.type?.replace(/^activity\./, '');

    // Opens/clicks are engagement, not delivery — recorded separately so they never
    // clobber a terminal deliveryStatus like 'delivered' or 'bounced'.
    if (kind === 'opened' || kind === 'clicked') {
      const linkUrl = event.data?.meta?.url || event.data?.meta?.click?.url;
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, linkUrl);
      if (!matched) console.warn(`[MailerSend Webhook] No log row for ${providerMessageId} (${event.type})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[kind ?? ''];
    if (!status) return NextResponse.json({ ok: true, ignored: event.type });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);

    // 200 even when unmatched — the id may belong to a send this app didn't log, and a
    // non-2xx would make MailerSend retry an event that can never match.
    if (!matched) console.warn(`[MailerSend Webhook] No log row for ${providerMessageId} (${event.type})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[MailerSend Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
