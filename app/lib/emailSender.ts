import { sendViaPostmark } from '@/app/lib/postmark';
import { sendViaSmtp2go } from '@/app/lib/smtp2go';
import { getActiveEmailProvider, type EmailProvider } from '@/app/lib/emailProviderSettings';

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
   *  both providers' ids get stored in the same providerMessageId field. Callers need this
   *  to know which status-lookup API a log row should later be reconciled against. */
  provider: EmailProvider;
}

/** Sends through whichever stopgap provider is currently active (set in the admin panel),
 *  so the three send routes don't each need their own provider-switch logic. Resend stays
 *  untouched and commented at each call site — this dispatcher only covers the Postmark /
 *  SMTP2GO choice, not a Resend revert. */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = await getActiveEmailProvider();
  const result = provider === 'smtp2go' ? await sendViaSmtp2go(params) : await sendViaPostmark(params);
  return { ...result, provider };
}
