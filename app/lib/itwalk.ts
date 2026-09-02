/** itWALK sender for the single/manual "Send Email" tab — a reseller wrapper around
 *  Infobip's email infrastructure (recognizable from the response schema: bulkId,
 *  PENDING_ENROUTE, groupName, etc.). First provider all session whose full branded
 *  QuickBooks-styled template (header/footer/logo/invoice table) has actually been
 *  delivered to a real inbox without being flagged — set as default 2026-09-02.
 *
 *  Uses multipart/form-data, not JSON, unlike every other provider wired in so far.
 *  API docs (PDF, not publicly hosted) confirm the endpoint/auth/body shape below. */

const ITWALK_API = 'https://e.api.itwalk.in/email/1/send';

export interface ItwalkSendParams {
  /** "Name <email>" or a bare email address. */
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface ItwalkSendResult {
  data?: { id: string };
  error?: { message: string };
}

export async function sendViaItwalk(params: ItwalkSendParams): Promise<ItwalkSendResult> {
  const apiKey = process.env.ITWALK_API_KEY;
  if (!apiKey) {
    return { error: { message: 'ITWALK_API_KEY not configured' } };
  }

  try {
    const form = new FormData();
    form.append('from', params.from);
    form.append('to', params.to);
    form.append('subject', params.subject);
    form.append('html', params.html);
    if (params.replyTo) form.append('replyTo', params.replyTo);

    // Delivery-report webhook — itWALK/Infobip push DLR events here as they happen,
    // rather than requiring a poll. No signature scheme is documented for this callback
    // (unlike Postwing/Maileroo's HMAC), so the webhook route only trusts events that
    // match a real logged providerMessageId rather than authenticating the caller itself.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com';
    form.append('notifyUrl', `${baseUrl}/api/webhooks/itwalk`);
    form.append('notifyContentType', 'application/json');
    form.append('intermediateReport', 'true');
    form.append('trackingUrl', `${baseUrl}/api/webhooks/itwalk`);

    const res = await fetch(ITWALK_API, {
      method: 'POST',
      headers: { Authorization: `App ${apiKey}` },
      body: form,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = json?.requestError?.serviceException?.text || json?.message || `itWALK error ${res.status}`;
      return { error: { message } };
    }

    const id = json?.messages?.[0]?.messageId || '';
    if (!id) return { error: { message: 'itWALK response had no messageId' } };

    return { data: { id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'itWALK request failed' } };
  }
}
