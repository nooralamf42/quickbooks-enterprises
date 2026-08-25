import { connectToDatabase } from '@/app/lib/mongodb';

export type EmailProvider = 'postmark' | 'smtp2go';

const SETTINGS_ID = 'emailProvider';
const DEFAULT_PROVIDER: EmailProvider = 'postmark';

/** Which stopgap provider (Postmark or SMTP2GO) is actually used for sending right now.
 *  Stored in Mongo rather than an env var so it can be switched live from the admin panel
 *  without a redeploy — both routes and the UI read the same value. */
export async function getActiveEmailProvider(): Promise<EmailProvider> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('appSettings').findOne({ _id: SETTINGS_ID as any });
    return (doc?.value as EmailProvider) || DEFAULT_PROVIDER;
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
