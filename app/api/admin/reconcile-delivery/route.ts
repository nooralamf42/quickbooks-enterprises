import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { updateDeliveryStatus, type DeliveryStatus } from '@/app/lib/emailLog';

export const maxDuration = 300;

/** Pulls the current status of any message still awaiting a verdict straight from Resend.
 *
 *  The delivery webhook is the primary mechanism, but it cannot reach localhost and it never
 *  fires for a suppressed address — a message to a previously-bounced recipient generates no
 *  events at all and would sit on "accepted" forever. This closes both gaps.
 *
 *  Requires a full-access RESEND_API_KEY; a sending-only key returns 401 here. */

/** Resend's 10 req/sec team limit, with headroom. */
const POLL_GAP_MS = 120;
const MAX_LOOKUPS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Maps Resend's `last_event` onto our stored status. Anything unlisted (queued, scheduled)
 *  means no verdict yet, so the row is left alone to be retried next run. */
const EVENT_STATUS: Record<string, DeliveryStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  delivery_delayed: 'delayed',
  bounced: 'bounced',
  complained: 'complained',
  failed: 'failed',
  canceled: 'failed',
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const { db } = await connectToDatabase();
    const pending = await db.collection('emailLogs')
      .find({
        resendId: { $exists: true, $ne: null },
        deliveryStatus: { $in: ['accepted', 'sent', 'delayed'] },
      })
      .sort({ sentAt: -1 })
      .limit(MAX_LOOKUPS)
      .toArray();

    if (!pending.length) {
      return NextResponse.json({ checked: 0, updated: 0, message: 'Nothing awaiting a delivery verdict.' });
    }

    let updated = 0;
    let unavailable = 0;
    const changes: { toEmail: string; from: string; to: string; detail?: string }[] = [];

    for (const row of pending) {
      try {
        const res = await fetch(`https://api.resend.com/emails/${row.resendId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (res.status === 401 || res.status === 403) {
          // Sending-only key — no point walking the rest of the list.
          return NextResponse.json({
            error: 'This RESEND_API_KEY cannot read message status. Create a full-access key in Resend.',
            checked: changes.length, updated,
          }, { status: 400 });
        }
        if (!res.ok) { unavailable++; continue; }

        const body = await res.json() as { last_event?: string };
        const status = EVENT_STATUS[body.last_event ?? ''];
        if (!status || status === row.deliveryStatus) continue;

        const detail = status === 'bounced'
          ? 'Bounced — address rejected by the receiving server'
          : undefined;

        if (await updateDeliveryStatus(row.resendId, status, detail)) {
          updated++;
          changes.push({ toEmail: row.toEmail, from: row.deliveryStatus, to: status, detail });
        }
      } catch {
        unavailable++;
      }
      await sleep(POLL_GAP_MS);
    }

    return NextResponse.json({ checked: pending.length, updated, unavailable, changes });
  } catch (err: any) {
    console.error('[Reconcile Delivery] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
