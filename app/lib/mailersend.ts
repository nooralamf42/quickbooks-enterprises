/** MailerSend sender for the single/manual "Send Email" tab only — bulk and order-triggered
 *  sends stay on Postmark. Added after SMTP2GO's account was permanently banned; on the
 *  14-day Professional trial (card-verified, no manual brand review) to sidestep the same
 *  review-team rejection that hit Resend, Postmark, and SMTP2GO. */

const MAILERSEND_API = 'https://api.mailersend.com/v1/email';

export interface MailerSendSendParams {
  /** "Name <email>" or a bare email address — split into MailerSend's separate name/email fields. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface MailerSendSendResult {
  data?: { id: string };
  error?: { message: string };
}

/** Splits Resend/Postmark-style "Name <email>" into MailerSend's {name, email} shape. */
function parseAddress(value: string): { email: string; name?: string } {
  const match = value.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: value.trim() };
}

export async function sendViaMailerSend(params: MailerSendSendParams): Promise<MailerSendSendResult> {
  const token = process.env.MAILERSEND_API_TOKEN;
  if (!token) {
    return { error: { message: 'MAILERSEND_API_TOKEN not configured' } };
  }

  try {
    const res = await fetch(MAILERSEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: parseAddress(params.from),
        to: [parseAddress(params.to)],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: parseAddress(params.replyTo) } : {}),
      }),
    });

    // A successful send is 202 Accepted with an empty body — the message id comes back
    // in the x-message-id response header instead, not in JSON like Postmark/SMTP2GO.
    if (res.ok) {
      return { data: { id: res.headers.get('x-message-id') || '' } };
    }

    const json = await res.json().catch(() => ({}));
    if (json.errors) {
      const firstField = Object.keys(json.errors)[0];
      const firstMessage = firstField ? json.errors[firstField]?.[0] : undefined;
      return { error: { message: firstMessage || json.message || `MailerSend error ${res.status}` } };
    }
    return { error: { message: json.message || `MailerSend error ${res.status}` } };
  } catch (err: any) {
    return { error: { message: err?.message || 'MailerSend request failed' } };
  }
}
