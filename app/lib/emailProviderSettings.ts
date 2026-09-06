import { connectToDatabase } from '@/app/lib/mongodb';

// 'mailersend' and 'mailpace' stay valid here for historical emailLogs rows (provider field)
// even though they're no longer selectable — see VALID_PROVIDERS below.
export type EmailProvider = 'postmark' | 'mailersend' | 'mailpace' | 'zeptomail' | 'maileroo' | 'itwalk';

// Only itWALK is switchable right now. MailerSend and MailPace were pulled after
// account-level blocks (code stays, not deleted). Postwing was tried 2026-08-28 and its
// domain got banned outright ("domain_banned" / "spam_ai") for the same branded-content
// pattern every other provider has reacted to — fully removed 2026-08-30 (unlike
// MailerSend/MailPace, its code isn't kept around; 'postwing' only survives in
// emailLog.ts's historical provider union for old log rows). ZeptoMail and Maileroo were
// pulled from the toggle 2026-09-04 in favor of itWALK (a reseller wrapper around Infobip's
// email infra, the first provider whose delivery survived the full branded template
// unflagged) — code stays, not deleted, same as MailerSend/MailPace.
export const VALID_PROVIDERS: EmailProvider[] = ['itwalk'];
const SETTINGS_ID = 'emailProvider';
const DEFAULT_PROVIDER: EmailProvider = 'itwalk';

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
