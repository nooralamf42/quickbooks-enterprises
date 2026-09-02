import { NextRequest, NextResponse } from 'next/server';
import {
  updateDeliveryStatusByProviderMessageId,
  recordEngagementByProviderMessageId,
  type DeliveryStatus,
} from '@/app/lib/emailLog';

/** itWALK/Infobip delivery reports and open/click tracking — both land on this one
 *  endpoint (see notifyUrl/trackingUrl in app/lib/itwalk.ts). No signature scheme is
 *  documented for either callback, so this route can't cryptographically verify the
 *  caller — it only trusts events that match a real logged providerMessageId, and
 *  silently ignores (200, not matched) anything that doesn't. Manual sends only
 *  (itWALK is scoped to the Send Email tab, not bulk). Can't receive events on
 *  localhost — itWALK needs a real deployed URL. */

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
  UNDELIVERABLE: 'bounced',
  EXPIRED: 'failed',
};

interface DlrPayload {
  results?: {
    messageId?: string;
    status?: { groupName?: string };
  }[];
}

interface TrackingPayload {
  notificationType?: string; // "OPENED" | "CLICKED"
  messageId?: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as DlrPayload & TrackingPayload;

    // Tracking notifications arrive as a single object with notificationType.
    if (body.notificationType === 'OPENED' || body.notificationType === 'CLICKED') {
      const providerMessageId = body.messageId;
      if (!providerMessageId) return NextResponse.json({ ok: true, ignored: 'no messageId' });
      const kind = body.notificationType === 'CLICKED' ? 'clicked' : 'opened';
      const matched = await recordEngagementByProviderMessageId(providerMessageId, kind, body.url);
      if (!matched) console.warn(`[itWALK Webhook] No log row for ${providerMessageId} (${body.notificationType})`);
      return NextResponse.json({ ok: true, matched, kind });
    }

    // Delivery reports arrive as { results: [{ messageId, status: { groupName } }] }.
    if (Array.isArray(body.results)) {
      const outcomes: { messageId: string; matched: boolean; status?: DeliveryStatus }[] = [];
      for (const result of body.results) {
        const providerMessageId = result.messageId;
        const groupName = result.status?.groupName;
        if (!providerMessageId || !groupName) continue;

        const status = EVENT_STATUS[groupName];
        if (!status) {
          outcomes.push({ messageId: providerMessageId, matched: false });
          continue;
        }

        const matched = await updateDeliveryStatusByProviderMessageId(providerMessageId, status);
        if (!matched) console.warn(`[itWALK Webhook] No log row for ${providerMessageId} (${groupName})`);
        outcomes.push({ messageId: providerMessageId, matched, status });
      }
      return NextResponse.json({ ok: true, outcomes });
    }

    return NextResponse.json({ ok: true, ignored: 'unrecognized payload shape' });
  } catch (err: any) {
    console.error('[itWALK Webhook] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
