/** Maileroo sender for the single/manual "Send Email" tab only — same scope as every other
 *  stopgap provider tried, bulk and order sends stay on Postmark. Added 2026-08-30 to replace
 *  Postwing, which was pulled after its domain got banned outright for the same
 *  QuickBooks-branded content pattern that's tripped every other provider. */

const MAILEROO_API = 'https://smtp.maileroo.com/api/v2/emails';

export interface MailerooSendParams {
  /** "Name <email>" or a bare email address. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface MailerooSendResult {
  data?: { id: string };
  error?: { message: string };
}

function parseAddress(value: string): { address: string; display_name?: string } {
  const match = value.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    return { address: match[2].trim(), display_name: name || undefined };
  }
  return { address: value.trim() };
}

export async function sendViaMaileroo(params: MailerooSendParams): Promise<MailerooSendResult> {
  const apiKey = process.env.MAILEROO_API_KEY;
  if (!apiKey) {
    return { error: { message: 'MAILEROO_API_KEY not configured' } };
  }

  try {
    const res = await fetch(MAILEROO_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: parseAddress(params.from),
        to: [parseAddress(params.to)],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: [parseAddress(params.replyTo)] } : {}),
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.success === false) {
      const message = json?.message || `Maileroo error ${res.status}`;
      return { error: { message } };
    }

    const id = json?.data?.reference_id || '';
    return { data: { id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'Maileroo request failed' } };
  }
}
