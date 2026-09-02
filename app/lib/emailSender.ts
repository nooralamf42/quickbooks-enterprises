import { sendViaPostmark } from '@/app/lib/postmark';
import { sendViaMailerSend } from '@/app/lib/mailersend';
import { sendViaMailPace } from '@/app/lib/mailpace';
import { sendViaZeptoMail } from '@/app/lib/zeptomail';
import { sendViaMaileroo } from '@/app/lib/maileroo';
import { sendViaItwalk } from '@/app/lib/itwalk';
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
   *  both providers' ids get stored in the same providerMessageId field. */
  provider: EmailProvider;
}

/** Sends through whichever provider is active for manual sends (set in the admin panel) —
 *  used by send-custom-email only. Bulk and order-triggered sends call sendViaPostmark()
 *  directly instead, since they're Postmark-only and don't need this switch. */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const provider = await getActiveEmailProvider();
  const result =
    provider === 'mailersend' ? await sendViaMailerSend(params)
    : provider === 'mailpace' ? await sendViaMailPace(params)
    : provider === 'zeptomail' ? await sendViaZeptoMail(params)
    : provider === 'maileroo' ? await sendViaMaileroo(params)
    : provider === 'itwalk' ? await sendViaItwalk(params)
    : await sendViaPostmark(params);
  return { ...result, provider };
}
