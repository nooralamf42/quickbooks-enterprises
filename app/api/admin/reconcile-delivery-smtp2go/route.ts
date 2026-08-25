import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import {
  updateDeliveryStatusByProviderMessageId,
  applyEngagementSnapshot,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

export const maxDuration = 300;

/** Pulls real delivery/open/click status from SMTP2GO's /email/search for any message still
 *  awaiting a verdict. SMTP2GO has no webhook wired up yet (their webhooks carry no signature
 *  verification — see the memory on this), so polling is the only mechanism for these rows,
 *  not a gap-filler alongside a webhook the way reconcile-delivery is for Resend.
 *
 *  Requires an SMTP2GO_API_KEY with the /email/search permission enabled (the send-only
 *  default scope will 403 here). */

const POLL_GAP_MS = 120;
const MAX_LOOKUPS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Smtp2goSearchEmail {
  status?: string;
  process_status?: string;
  total_opens?: number;
  total_clicks?: number;
}

/** SMTP2GO's status strings (Processed, Delivered, Soft Bounce, Hard Bounce, Rejected, Spam,
 *  Unsubscribed) — matched case-insensitively by substring since the API mixes casing
 *  ("delivered" vs "Submission" observed directly). Negative outcomes take priority: a search
 *  can return multiple timeline entries per message, and a later bounce should win over an
 *  earlier "processed" entry. */
function worstStatus(emails: Smtp2goSearchEmail[]): DeliveryStatus | null {
  const statuses = emails.map((e) => (e.status || '').toLowerCase());
  if (statuses.some((s) => s.includes('bounce') || s.includes('reject'))) return 'bounced';
  if (statuses.some((s) => s.includes('spam'))) return 'complained';
  if (statuses.some((s) => s.includes('delivered'))) return 'delivered';
  return null; // still just "Processed"/"Submission" — no verdict yet
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }
    const apiKey = process.env.SMTP2GO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'SMTP2GO_API_KEY not configured' }, { status: 500 });
    }

    const { db } = await connectToDatabase();
    const pending = await db.collection('emailLogs')
      .find({
        provider: 'smtp2go',
        providerMessageId: { $exists: true, $ne: null },
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
    const changes: { toEmail: string; from: string; to: string }[] = [];

    for (const row of pending) {
      try {
        const res = await fetch('https://api.smtp2go.com/v3/email/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Smtp2go-Api-Key': apiKey },
          body: JSON.stringify({ email_id: row.providerMessageId }),
        });
        const body = await res.json().catch(() => ({}));

        if (body?.data?.error_code === 'E_ApiResponseCodes.ENDPOINT_PERMISSION_DENIED') {
          return NextResponse.json({
            error: 'This SMTP2GO_API_KEY cannot read message status. Add /email/search permission to the key.',
            checked: changes.length, updated,
          }, { status: 400 });
        }
        if (!res.ok || !body?.data?.emails) { unavailable++; continue; }

        const emails: Smtp2goSearchEmail[] = body.data.emails;
        const status = worstStatus(emails);
        const openCount = Math.max(0, ...emails.map((e) => e.total_opens || 0));
        const clickCount = Math.max(0, ...emails.map((e) => e.total_clicks || 0));

        if (openCount > 0 || clickCount > 0) {
          await applyEngagementSnapshot(row.providerMessageId, { openCount, clickCount });
        }

        if (!status || status === row.deliveryStatus) continue;

        if (await updateDeliveryStatusByProviderMessageId(row.providerMessageId, status)) {
          updated++;
          changes.push({ toEmail: row.toEmail, from: row.deliveryStatus, to: status });
        }
      } catch {
        unavailable++;
      }
      await sleep(POLL_GAP_MS);
    }

    return NextResponse.json({ checked: pending.length, updated, unavailable, changes });
  } catch (err: any) {
    console.error('[Reconcile Delivery SMTP2GO] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
