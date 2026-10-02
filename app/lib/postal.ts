/** Postal sender for the single/manual "Send Email" tab — our own self-hosted mail server
 *  (Postal 3.3.7), added 2026-09-08 after a multi-day infra project to make it reachable
 *  from Vercel at all. Split across two servers sharing one MariaDB database because no
 *  single VPS had every port we needed open: web+Caddy (dashboard/API, what this file talks
 *  to) runs on AWS where port 443 works; smtp+worker (actual outbound delivery) stays on the
 *  original VPS where port 25 and its SMTP PTR/FCrDNS alignment already work. Full send flow
 *  (AWS API -> shared DB -> other server's worker -> Gmail, accepted) verified live before
 *  this was wired in.
 *
 *  Response shape (recognizable vs. every other provider here): {status, data: {message_id,
 *  messages: {"<recipient>": {id, token}}}} — id/token are per-recipient, message_id is a
 *  single Message-ID-style string shared across all recipients on the send. */

const POSTAL_API = process.env.POSTAL_API_URL || 'https://mail2.quickbooks-enterprises.com/api/v1/send/message';

// Postal message ids are per-server counters, and the older server's ids (1..~260) overlap
// the new server's. Delivery/engagement webhooks look log rows up by providerMessageId alone,
// so an unprefixed id from this server could update a different, older row. The webhook
// route re-adds this prefix for events posted to /api/webhooks/postal?server=mail2. Only
// applied while POSTAL_API_URL actually points at the mail2 host, so sends that still go to
// the older server (env not switched yet) keep the bare ids its own webhook reports.
export const MAIL2_ID_PREFIX = 'mail2-';

/** Postal appends a hidden open-tracking image to every tracked email it sends. A copy of the
 *  email taken back out of Postal must not keep it: rendering that copy (the Email Logs PDF)
 *  would load the pixel and register a fake "open" on the original message. */
export function stripPostalTrackingPixel(html: string): string {
  return html.replace(/<p class=['"]ampimg['"][\s\S]*?<\/p>/i, '');
}
const ID_PREFIX = POSTAL_API.includes('//mail2.') ? MAIL2_ID_PREFIX : '';

// The only domain verified/DKIM-signed on our Postal server — every other provider wired
// in here sends from the bare quickbooks-enterprises.com, but Postal rejects that outright
// ("The From address is not authorised to send mail from this server"). Rewriting the
// domain here means callers (send-custom-email, etc.) don't need a Postal-specific from
// address; they keep using the same literal they pass to every other provider.
const VERIFIED_SEND_DOMAIN = 'mail.quickbooks-enterprises.com';

// Every Postal email is answered at this mailbox, whatever reply-to the caller passed. The
// From address is on the mail. subdomain, whose MX points at the Postal server rather than a
// mailbox, so a plain reply to it would go nowhere.
const POSTAL_REPLY_TO = 'notifications@quickbooks-enterprises.com';

function toVerifiedDomain(from: string): string {
  const match = from.match(/^(.*)<(.+)@(.+)>$/);
  if (match) {
    const [, namePart, local] = match;
    return `${namePart}<${local}@${VERIFIED_SEND_DOMAIN}>`;
  }
  const bare = from.match(/^(.+)@(.+)$/);
  if (bare) return `${bare[1]}@${VERIFIED_SEND_DOMAIN}`;
  return from;
}

export interface PostalSendParams {
  /** "Name <email>" or a bare email address. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface PostalSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaPostal(params: PostalSendParams): Promise<PostalSendResult> {
  const apiKey = process.env.POSTAL_API_KEY;
  if (!apiKey) {
    return { error: { message: 'POSTAL_API_KEY not configured' } };
  }

  try {
    const res = await fetch(POSTAL_API, {
      method: 'POST',
      headers: {
        'X-Server-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [params.to],
        from: toVerifiedDomain(params.from),
        subject: params.subject,
        html_body: params.html,
        reply_to: POSTAL_REPLY_TO,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.status !== 'success') {
      const message = json?.data?.message || json?.error?.message || `Postal error ${res.status}`;
      return { error: { message } };
    }

    // Per-recipient id, not the shared message_id — this is what the worker logs
    // (queued_message=<id>) and what the delivery webhook's payload.message.id will match.
    const id = json?.data?.messages?.[params.to]?.id;
    if (!id) return { error: { message: 'Postal response had no message id for recipient' } };

    return { data: { id: `${ID_PREFIX}${id}` } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Postal request failed' } };
  }
}
