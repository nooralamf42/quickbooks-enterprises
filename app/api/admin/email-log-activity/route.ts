import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

/** Escapes regex metacharacters so an email address is matched literally. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Backs the Email Log PDF's "Activity Log" section with real tracked activity, not just the
 *  email's own send/open/click timestamps: click-tracking events (link opened, email entered
 *  on the payment page) from `user_events`, and — when the email's orderId is a real admindata
 *  _id — that order's actual payment outcome. There's no stored link between an email log row
 *  and the payment-link token used to track it, so events are matched by recipient email plus
 *  (when available) an exact dollar-amount match, which in practice is specific enough to pick
 *  out the one relevant purchase rather than every interaction that email address ever had. */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const toEmail = (searchParams.get('toEmail') || '').trim();
    const orderId = (searchParams.get('orderId') || '').trim();
    const amountRaw = searchParams.get('amountUSD');

    const { db } = await connectToDatabase();

    let events: { event: string; timestamp: Date }[] = [];
    if (toEmail) {
      const eventFilter: Record<string, unknown> = {
        email: { $regex: `^${escapeRegex(toEmail)}$`, $options: 'i' },
      };
      if (amountRaw !== null && amountRaw !== '' && !isNaN(Number(amountRaw))) {
        eventFilter.amount = Number(amountRaw);
      }

      const rawEvents = await db.collection('user_events')
        .find(eventFilter)
        .sort({ timestamp: 1 })
        .limit(50)
        .toArray();

      events = rawEvents.map(e => ({ event: e.event, timestamp: e.timestamp }));
    }

    let order: { status?: string; paidAt?: Date; updatedAt?: Date; fsOrderReference?: string } | null = null;
    if (orderId && ObjectId.isValid(orderId)) {
      const found = await db.collection('admindata').findOne(
        { _id: new ObjectId(orderId) },
        { projection: { status: 1, paidAt: 1, updatedAt: 1, fsOrderReference: 1 } }
      );
      if (found) {
        order = {
          status: found.status,
          paidAt: found.paidAt,
          updatedAt: found.updatedAt,
          fsOrderReference: found.fsOrderReference,
        };
      }
    }

    return NextResponse.json({ events, order });
  } catch (err: any) {
    console.error('[Email Log Activity] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
