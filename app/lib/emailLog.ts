import { connectToDatabase } from '@/app/lib/mongodb';

/** What Resend last told us about this message.
 *  `accepted` is the state every send starts in: Resend took the message and returned an id,
 *  but nothing is known about delivery yet. Bounces typically land seconds later, so
 *  `accepted` must never be presented to an admin as "delivered". */
export type DeliveryStatus =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'delayed'
  | 'bounced'
  | 'complained'
  | 'rejected'
  | 'failed';

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
  trigger: 'authorize-webhook' | 'authorize-sync' | 'authorize-complete' | 'admin-manual' | 'admin-order' | 'admin-bulk';
  /** Resend's message id. The join key for delivery webhooks — without it a log row
   *  can never be reconciled against what actually happened to the message. */
  resendId?: string;
  /** Set when the send was rejected outright, so the row records the failure rather than
   *  being silently absent from the log. */
  deliveryStatus?: DeliveryStatus;
  /** Human-readable reason for a non-delivery, straight from the provider. */
  deliveryDetail?: string;
}

/** Records that an email was sent, for audit purposes. Never throws — a logging failure must not block the send. */
export async function logEmailSent(entry: EmailLogEntry): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('emailLogs').insertOne({
      ...entry,
      deliveryStatus: entry.deliveryStatus ?? 'accepted',
      sentAt: new Date(),
      statusUpdatedAt: new Date(),
    });
  } catch (err) {
    console.error('[EmailLog] Failed to record sent email:', err);
  }
}

/** Applies a delivery event from Resend to the matching log row. Never throws — a webhook
 *  that 500s gets retried, and a logging failure is not worth a retry storm. */
export async function updateDeliveryStatus(
  resendId: string,
  status: DeliveryStatus,
  detail?: string,
): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('emailLogs').updateOne(
      { resendId },
      {
        $set: {
          deliveryStatus: status,
          ...(detail ? { deliveryDetail: detail } : {}),
          statusUpdatedAt: new Date(),
        },
      },
    );
    return res.matchedCount > 0;
  } catch (err) {
    console.error('[EmailLog] Failed to update delivery status:', err);
    return false;
  }
}
