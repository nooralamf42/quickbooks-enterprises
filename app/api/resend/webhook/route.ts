import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { updateDeliveryStatus, recordEngagement, type DeliveryStatus } from '@/app/lib/emailLog';

/** Resend delivery events, so the email log reflects what actually happened to a message
 *  rather than only that Resend accepted it. Configure at resend.com/webhooks pointing to
 *  https://<your-domain>/api/resend/webhook and put the signing secret in RESEND_WEBHOOK_SECRET.
 *
 *  Note this endpoint can only receive events once deployed — Resend cannot reach localhost. */

/** Reject events older than this to blunt replay attempts. Svix's own tolerance is 5 minutes. */
const TOLERANCE_SECONDS = 5 * 60;

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

/** Verifies a Svix signature (the scheme Resend uses) without pulling in the svix package.
 *  The header carries a space-separated list of `v1,<base64sig>` — any one matching is valid,
 *  which is what lets Resend rotate secrets without dropping events. */
function verifySignature(secret: string, id: string, timestamp: string, body: string, header: string): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return header.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    // Lengths must match before timingSafeEqual, which throws on a mismatch.
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
    }

    const age = Math.abs(Date.now() / 1000 - Number(svixTimestamp));
    if (!isFinite(age) || age > TOLERANCE_SECONDS) {
      return NextResponse.json({ error: 'Timestamp outside tolerance' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!verifySignature(secret, svixId, svixTimestamp, raw, svixSignature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      type?: string;
      data?: {
        email_id?: string;
        to?: string[];
        bounce?: { message?: string; subType?: string };
        click?: { link?: string };
      };
    };

    const resendId = event.data?.email_id;
    if (!resendId) return NextResponse.json({ ok: true, ignored: 'no email_id' });

    // Opens/clicks are engagement, not delivery — recorded separately so they never
    // clobber a terminal deliveryStatus like 'delivered' or 'bounced'.
    if (event.type === 'email.opened' || event.type === 'email.clicked') {
      const kind = event.type === 'email.opened' ? 'opened' : 'clicked';
      const matched = await recordEngagement(resendId, kind, event.data?.click?.link);
      if (!matched) console.warn(`[Resend Webhook] No log row for ${resendId} (${event.type})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    const status = EVENT_STATUS[event.type ?? ''];
    if (!status) return NextResponse.json({ ok: true, ignored: event.type });

    const detail = event.data?.bounce?.message || event.data?.bounce?.subType;
    const matched = await updateDeliveryStatus(resendId, status, detail);

    // 200 even when unmatched — the id belongs to a send this app didn't log (or predates
    // id tracking), and a non-2xx would make Resend retry an event that can never match.
    if (!matched) console.warn(`[Resend Webhook] No log row for ${resendId} (${event.type})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[Resend Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
