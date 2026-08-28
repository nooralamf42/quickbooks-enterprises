/** Postwing sender for the single/manual "Send Email" tab only — same scope as every other
 *  stopgap provider added today, bulk and order sends stay on Postmark. Its abuse detection
 *  is built around spam-list/volume-pattern signals rather than the brand/logo content
 *  scanning that got Resend, Postmark, SMTP2GO, MailerSend, MailPace, and ZeptoMail to all
 *  react to this domain's QuickBooks-branded content in one way or another. */

const POSTWING_API = 'https://api.postwing.app/external/send_email_simple/';

export interface PostwingSendParams {
  /** "Name <email>" or a bare email address. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface PostwingSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaPostwing(params: PostwingSendParams): Promise<PostwingSendResult> {
  const username = process.env.POSTWING_USERNAME;
  const password = process.env.POSTWING_PASSWORD;
  if (!username || !password) {
    return { error: { message: 'POSTWING_USERNAME/POSTWING_PASSWORD not configured' } };
  }

  try {
    const res = await fetch(POSTWING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [params.to],
        subject: params.subject,
        body: params.html,
        sender: params.from,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        auth: { username, password },
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.ok === false) {
      const message = json?.error || json?.auth?.non_field_errors?.[0] || json?.emails?.[0]?.error || `Postwing error ${res.status}`;
      return { error: { message } };
    }

    const id = json?.emails?.[0]?.message_id || json?.emails?.[0]?.uuid || '';
    return { data: { id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Postwing request failed' } };
  }
}
