/** MailPace sender for the single/manual "Send Email" tab only — same scope as MailerSend/
 *  ZeptoMail, bulk and order sends stay on Postmark. Signed up 2026-08-26 after Resend,
 *  Postmark, SMTP2GO, MailerSend, and ZeptoMail all hit a sending block the same day. */

const MAILPACE_API = 'https://app.mailpace.com/api/v1/send';

export interface MailPaceSendParams {
  /** "Name <email>" or a bare email address — MailPace accepts this directly, no splitting. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface MailPaceSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaMailPace(params: MailPaceSendParams): Promise<MailPaceSendResult> {
  const token = process.env.MAILPACE_API_TOKEN;
  if (!token) {
    return { error: { message: 'MAILPACE_API_TOKEN not configured' } };
  }

  try {
    const res = await fetch(MAILPACE_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'MailPace-Server-Token': token,
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        htmlbody: params.html,
        ...(params.replyTo ? { replyto: params.replyTo } : {}),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = json?.errors?.[0] || json?.error || json?.message || `MailPace error ${res.status}`;
      return { error: { message } };
    }
    // MailPace returns a numeric id (e.g. { id: 43884059, status: "queued" }) — every other
    // provider here returns a string, so this is coerced for a consistent providerMessageId.
    return { data: { id: String(json?.id ?? '') } };
  } catch (err: any) {
    return { error: { message: err?.message || 'MailPace request failed' } };
  }
}
