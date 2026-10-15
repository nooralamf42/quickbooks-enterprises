import { sendViaPostmark } from '@/app/lib/postmark';
import { sendViaMailerSend } from '@/app/lib/mailersend';
import { sendViaMailPace } from '@/app/lib/mailpace';
import { sendViaZeptoMail } from '@/app/lib/zeptomail';
import { sendViaMaileroo } from '@/app/lib/maileroo';
import { sendViaMsg91, type Msg91TemplatePayload } from '@/app/lib/msg91';
import { sendViaPostal } from '@/app/lib/postal';
import { getActiveEmailProvider, type EmailProvider } from '@/app/lib/emailProviderSettings';
import { checkDomainHasMailServer } from '@/app/lib/emailValidation';

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Required when the active provider is MSG91, which sends from an approved template +
   *  structured variables instead of the raw `html` above. Other providers ignore this. */
  msg91?: Msg91TemplatePayload;
}

/** "Name <email@domain>" -> { name, email }; falls back to using the whole string as both
 *  when it isn't in that form. */
function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: from, email: from };
}

export interface SendEmailResult {
  data?: { id: string };
  error?: { message: string };
  /** Which provider actually handled this send — the message id alone doesn't say, since
   *  both providers' ids get stored in the same providerMessageId field. */
  provider: EmailProvider;
  /** The exact HTML handed to the provider, echoed back so callers can store it with the log
   *  row (the Email Logs PDF shows the sent email as its first page). */
  html?: string;
}

/** Sends through whichever provider is active (set in the admin panel) — the single funnel
 *  every send path (manual, bulk, order-triggered) goes through, so the MX pre-check below
 *  protects all of them uniformly regardless of which provider is currently active. */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = await getActiveEmailProvider();

  // Catches a domain with no mail servers at all (typo'd domains like "pchtechnoloies.com")
  // before wasting a real send attempt on it — every provider wired in here would just
  // bounce it independently a few seconds later anyway, so failing fast here saves the
  // round trip and gives a clearer reason than a provider-specific bounce message would.
  const mxCheck = await checkDomainHasMailServer(params.to);
  if (!mxCheck.valid) {
    return { error: { message: mxCheck.reason || 'Recipient domain cannot receive email' }, provider };
  }

  if (provider === 'msg91') {
    if (!params.msg91) {
      return { error: { message: 'No MSG91 template payload supplied for this send' }, provider, html: params.html };
    }
    const { name: fromName, email: fromEmail } = parseFromHeader(params.from);
    const result = await sendViaMsg91({
      fromName, fromEmail, toEmail: params.to, template: params.msg91,
    });
    return { ...result, provider, html: params.html };
  }

  const result =
    provider === 'mailersend' ? await sendViaMailerSend(params)
    : provider === 'mailpace' ? await sendViaMailPace(params)
    : provider === 'zeptomail' ? await sendViaZeptoMail(params)
    : provider === 'maileroo' ? await sendViaMaileroo(params)
    : provider === 'postal' ? await sendViaPostal(params)
    : await sendViaPostmark(params);
  return { ...result, provider, html: params.html };
}
