import { connectToDatabase } from '@/app/lib/mongodb';

// Lets an admin kill the email-OTP step from the dashboard (no redeploy) if MSG91 misbehaves —
// wallet runs dry, throttle blocks a wave of real customers, their account has an outage, etc.
// Disabled means the /auth flow goes Login -> Password -> Order Summary, same as before the OTP
// step existed. Same storage pattern as emailProviderSettings.ts (one doc in `appSettings`).
const SETTINGS_ID = 'otpStepEnabled';
const DEFAULT_ENABLED = true;

export async function isOtpStepEnabled(): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('appSettings').findOne({ _id: SETTINGS_ID as any });
    return typeof doc?.value === 'boolean' ? doc.value : DEFAULT_ENABLED;
  } catch (err) {
    console.error('[OtpSettings] Failed to read, defaulting to', DEFAULT_ENABLED, err);
    return DEFAULT_ENABLED;
  }
}

export async function setOtpStepEnabled(enabled: boolean): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('appSettings').updateOne(
    { _id: SETTINGS_ID as any },
    { $set: { value: enabled, updatedAt: new Date() } },
    { upsert: true },
  );
}
