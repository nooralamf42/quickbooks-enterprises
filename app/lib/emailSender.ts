import { sendViaPostmark } from '@/app/lib/postmark';
import { sendViaMailerSend } from '@/app/lib/mailersend';
import { sendViaMailPace } from '@/app/lib/mailpace';
import { sendViaZeptoMail } from '@/app/lib/zeptomail';
import { sendViaMaileroo } from '@/app/lib/maileroo';
import { sendViaItwalk } from '@/app/lib/itwalk';
import { sendViaPostal } from '@/app/lib/postal';
import { getActiveEmailProvider, type EmailProvider } from '@/app/lib/emailProviderSettings';
import { checkDomainHasMailServer } from '@/app/lib/emailValidation';

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  data?: { id: string };
  error?: { message: string };
  /** Which provider actually handled this send — the message id alone doesn't say, since
   *  both providers' ids get stored in the same providerMessageId field. */
  provider: EmailProvider;
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

  const result =
    provider === 'mailersend' ? await sendViaMailerSend(params)
    : provider === 'mailpace' ? await sendViaMailPace(params)
    : provider === 'zeptomail' ? await sendViaZeptoMail(params)
    : provider === 'maileroo' ? await sendViaMaileroo(params)
    : provider === 'itwalk' ? await sendViaItwalk(params)
    : provider === 'postal' ? await sendViaPostal(params)
    : await sendViaPostmark(params);
  return { ...result, provider };
}
