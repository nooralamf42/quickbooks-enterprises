/** ZeptoMail sender for the single/manual "Send Email" tab only — same scope as MailerSend,
 *  bulk and order sends stay on Postmark. Added after MailerSend's account approval was
 *  declined over an IP-rights/content-policy check. ZeptoMail's pending-review state allows
 *  100 emails/day to ANY recipient (no same-domain or 2-recipient restriction like Postmark/
 *  MailerSend had), so it's usable immediately while review is pending. */

// AU region — most ZeptoMail docs default to api.zeptomail.com, but this account's Mail
// Agent is provisioned on the .com.au host; using the wrong region fails auth outright.
const ZEPTOMAIL_API = 'https://api.zeptomail.com.au/v1.1/email';

export interface ZeptoMailSendParams {
  /** "Name <email>" or a bare email address. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface ZeptoMailSendResult {
  data?: { id: string };
  error?: { message: string };
}

function parseAddress(value: string): { address: string; name?: string } {
  const match = value.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    return { address: match[2].trim(), name: name || undefined };
  }
  return { address: value.trim() };
}

export async function sendViaZeptoMail(params: ZeptoMailSendParams): Promise<ZeptoMailSendResult> {
  const token = process.env.ZEPTOMAIL_API_TOKEN;
  if (!token) {
    return { error: { message: 'ZEPTOMAIL_API_TOKEN not configured' } };
  }

  try {
    const fromAddr = parseAddress(params.from);
    const toAddr = parseAddress(params.to);

    const res = await fetch(ZEPTOMAIL_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // Token already carries the "Zoho-enczapikey " prefix — not a Bearer token.
        Authorization: token,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [{ email_address: toAddr }],
        subject: params.subject,
        htmlbody: params.html,
        ...(params.replyTo ? { reply_to: [parseAddress(params.replyTo)] } : {}),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = json?.error?.details?.[0]?.message || json?.error?.message || json?.message || `ZeptoMail error ${res.status}`;
      return { error: { message } };
    }

    // Response shape isn't fully documented — request_id is always present and unique per
    // call, so it's used as the stored id even though it may not be a per-message tracking
    // id in ZeptoMail's own dashboard the way Postmark/MailerSend's ids are.
    const id = json?.request_id || json?.data?.[0]?.additional_info?.message_id || '';
    return { data: { id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'ZeptoMail request failed' } };
  }
}
