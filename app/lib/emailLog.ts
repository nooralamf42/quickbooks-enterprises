import { connectToDatabase } from '@/app/lib/mongodb';

export interface EmailLogEntry {
  /** What kind of email this was. */
  type: 'receipt' | 'reminder' | 'other';
  toEmail: string;
  customerName?: string;
  orderId?: string;
  planDetails?: string;
  amountUSD?: number;
  subject: string;
  /** Where the send was initiated from, for auditing. */
  trigger: 'authorize-webhook' | 'authorize-sync' | 'authorize-complete' | 'admin-manual' | 'admin-order';
}

/** Records that an email was sent, for audit purposes. Never throws — a logging failure must not block the send. */
export async function logEmailSent(entry: EmailLogEntry): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('emailLogs').insertOne({
      ...entry,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error('[EmailLog] Failed to record sent email:', err);
  }
}
