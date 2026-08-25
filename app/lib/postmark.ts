/** Stopgap sender while the Resend account is under review (suspended 2026-08-25).
 *  Every call site keeps its original resend.emails.send(...) call commented directly
 *  above the replacement — swap back in one step once Resend is reactivated. No schema
 *  or route logic changed: this returns the same { data, error } shape Resend's SDK does,
 *  so downstream handling (logEmailSent, result rows) needed zero changes. */

const POSTMARK_API = 'https://api.postmarkapp.com/email';

export interface PostmarkSendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface PostmarkSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaPostmark(params: PostmarkSendParams): Promise<PostmarkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return { error: { message: 'POSTMARK_SERVER_TOKEN not configured' } };
  }

  try {
    const res = await fetch(POSTMARK_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: params.from,
        To: params.to,
        Subject: params.subject,
        HtmlBody: params.html,
        ReplyTo: params.replyTo,
        // Postmark keeps transactional and marketing sending on physically separate
        // infrastructure — 'outbound' is the default transactional stream.
        MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.ErrorCode) {
      return { error: { message: json.Message || `Postmark error ${res.status}` } };
    }
    return { data: { id: json.MessageID } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Postmark request failed' } };
  }
}
