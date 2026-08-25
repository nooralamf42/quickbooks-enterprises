/** Second stopgap sender, alongside Postmark, while the Resend account is under review
 *  (suspended 2026-08-25). Unlike Postmark, SMTP2GO has no pre-send approval gate — domain
 *  verification is self-serve and sending works immediately, including cross-domain. Which
 *  of the two is actually used is chosen at request time by emailSender.ts, not hardcoded
 *  here. Returns the same { data, error } shape as sendViaPostmark/Resend's SDK so callers
 *  don't need provider-specific branches. */

const SMTP2GO_API = 'https://api.smtp2go.com/v3/email/send';

export interface Smtp2goSendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface Smtp2goSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaSmtp2go(params: Smtp2goSendParams): Promise<Smtp2goSendResult> {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) {
    return { error: { message: 'SMTP2GO_API_KEY not configured' } };
  }

  try {
    const res = await fetch(SMTP2GO_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': apiKey,
      },
      body: JSON.stringify({
        sender: params.from,
        to: [params.to],
        subject: params.subject,
        html_body: params.html,
        ...(params.replyTo
          ? { custom_headers: [{ header: 'Reply-To', value: params.replyTo }] }
          : {}),
      }),
    });

    const json = await res.json().catch(() => ({}));
    // SMTP2GO returns HTTP 200 even on rejection — the real result lives in data.failed/errors.
    const failed = json?.data?.failed;
    const failures: string[] = json?.data?.failures || [];

    if (!res.ok || failed) {
      return { error: { message: failures.join('; ') || json?.data?.error || `SMTP2GO error ${res.status}` } };
    }
    return { data: { id: json?.data?.email_id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'SMTP2GO request failed' } };
  }
}
