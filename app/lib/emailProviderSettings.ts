import { connectToDatabase } from '@/app/lib/mongodb';

// 'mailersend' and 'mailpace' stay valid here for historical emailLogs rows (provider field)
// even though they're no longer selectable — see VALID_PROVIDERS below.
export type EmailProvider = 'postmark' | 'mailersend' | 'mailpace' | 'zeptomail' | 'postwing';

// ZeptoMail and Postwing are switchable right now — MailerSend and MailPace both had
// account-level blocks and were pulled from the switcher. Not deleted from the codebase
// (unlike SMTP2GO, which was permanently banned) since either could be re-enabled if needed.
export const VALID_PROVIDERS: EmailProvider[] = ['zeptomail', 'postwing'];
const SETTINGS_ID = 'emailProvider';
const DEFAULT_PROVIDER: EmailProvider = 'zeptomail';

/** Which provider handles the single/manual "Send Email" tab right now. Bulk and
 *  order-triggered sends are Postmark-only and don't read this at all. Stored in Mongo
 *  rather than an env var so it can be switched live from the admin panel without a
 *  redeploy. Any stored value outside VALID_PROVIDERS (e.g. a leftover 'smtp2go' from
 *  before that provider was removed) falls back to the Postmark default, rather than
 *  needing a DB migration. */
export async function getActiveEmailProvider(): Promise<EmailProvider> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('appSettings').findOne({ _id: SETTINGS_ID as any });
    return VALID_PROVIDERS.includes(doc?.value) ? (doc!.value as EmailProvider) : DEFAULT_PROVIDER;
  } catch (err) {
    console.error('[EmailProviderSettings] Failed to read, defaulting to', DEFAULT_PROVIDER, err);
    return DEFAULT_PROVIDER;
  }
}

export async function setActiveEmailProvider(provider: EmailProvider): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('appSettings').updateOne(
    { _id: SETTINGS_ID as any },
    { $set: { value: provider, updatedAt: new Date() } },
    { upsert: true },
  );
}
