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

const POSTAL_API = process.env.POSTAL_API_URL || 'https://postal-dashboard.quickbooks-enterprises.com/api/v1/send/message';

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
        from: params.from,
        subject: params.subject,
        html_body: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
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

    return { data: { id: String(id) } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Postal request failed' } };
  }
}
