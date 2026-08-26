import { NextRequest, NextResponse } from 'next/server';
import { webcrypto } from 'crypto';
import {
  updateDeliveryStatusByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** MailPace delivery events, so the email log reflects what actually happened rather than
 *  only that MailPace queued the send. Configure in the MailPace dashboard under
 *  Webhooks -> New Endpoint, pointing to https://<your-domain>/api/webhooks/mailpace, and
 *  check delivered/deferred/bounced/spam (queued is skipped — already logged at send time).
 *
 *  Note this endpoint can only receive events once deployed — MailPace cannot reach
 *  localhost. Manual sends only (MailPace is scoped to the Send Email tab, not bulk). */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  queued: 'accepted',
  delivered: 'delivered',
  deferred: 'delayed',
  bounced: 'bounced',
  spam: 'complained',
};

/** MailPace signs the raw request body with Ed25519 (not HMAC) — the signature travels
 *  base64-encoded in the X-MailPace-Signature header, verified against a public key from
 *  the dashboard's Webhooks -> Public Key Verification page (also base64-encoded, raw
 *  32-byte key, not wrapped in a certificate/SPKI structure). */
async function verifySignature(publicKeyB64: string, body: string, signatureB64: string): Promise<boolean> {
  try {
    const keyBytes = Buffer.from(publicKeyB64, 'base64');
    const signatureBytes = Buffer.from(signatureB64, 'base64');
    const key = await webcrypto.subtle.importKey('raw', keyBytes, { name: 'Ed25519' }, false, ['verify']);
    return await webcrypto.subtle.verify('Ed25519', key, signatureBytes, Buffer.from(body, 'utf8'));
  } catch (err) {
    console.error('[MailPace Webhook] Signature verification error:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const publicKey = process.env.MAILPACE_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) {
      console.error('[MailPace Webhook] MAILPACE_WEBHOOK_PUBLIC_KEY is not configured');
      return NextResponse.json({ error: 'Webhook public key not configured' }, { status: 500 });
    }

    const signature = req.headers.get('x-mailpace-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Must verify against the exact bytes received, so read the raw body before parsing.
    const raw = await req.text();
    if (!(await verifySignature(publicKey, raw, signature))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw) as {
      event?: string; // e.g. "email.delivered"
      payload?: { id?: number | string; status?: string };
    };

    const providerMessageId = event.payload?.id != null ? String(event.payload.id) : undefined;
    if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no payload.id' });

    const status = EVENT_STATUS[event.payload?.status ?? ''];
    if (!status) return NextResponse.json({ ok: true, ignored: event.event });

    const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);

    // 200 even when unmatched — the id may belong to a send this app didn't log, and a
    // non-2xx would make MailPace retry an event that can never match.
    if (!matched) console.warn(`[MailPace Webhook] No log row for ${providerMessageId} (${event.event})`);

    return NextResponse.json({ ok: true, matched, status });
  } catch (err: any) {
    console.error('[MailPace Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
