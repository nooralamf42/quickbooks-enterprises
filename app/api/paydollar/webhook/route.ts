import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyDatafeedSecureHash } from '@/app/lib/paydollar';

// PayDollar's Data Feed reads the literal word "OK" from the response body to decide whether
// the notification was delivered; anything else and it assumes the feed was lost and retries.
const ACK = () => new NextResponse('OK', { status: 200 });

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const get = (key: string) => params.get(key) || '';

    const successcode = get('successcode');
    const ref = get('Ref');
    const payRef = get('PayRef');
    const src = get('src');
    const prc = get('prc');
    const cur = get('Cur');
    const amt = get('Amt');
    const payerAuth = get('payerAuth');
    const secureHash = get('secureHash');

    if (!ref || !ObjectId.isValid(ref)) {
      console.warn('[PayDollar Webhook] No valid Ref in datafeed payload');
      return ACK();
    }

    const secret = process.env.PAYDOLLAR_SECURE_HASH_SECRET?.trim();
    if (secret) {
      const valid = verifyDatafeedSecureHash({ src, prc, successcode, ref, payRef, cur, amt, payerAuth }, secret, secureHash);
      if (!valid) {
        console.error('[PayDollar Webhook] Invalid secure hash, ignoring notification for', ref);
        return ACK();
      }
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(ref) });

    if (!record) {
      console.warn('[PayDollar Webhook] Order not found:', ref);
      return ACK();
    }

    if (record.status === 'Completed') {
      return ACK();
    }

    if (successcode === '0') {
      const amountUSD = amt ? Number(amt) : record.amountUSD;
      await db.collection('admindata').updateOne(
        { _id: new ObjectId(ref) },
        {
          $set: {
            status: 'Completed',
            fsOrderReference: `PAYDOLLAR-${payRef}`,
            fsOrderId: payRef,
            gateway: 'PayDollar',
            paidAt: new Date(),
            amountUSD,
            paymentMethodLabel: get('payMethod') || 'Card on file',
            updatedAt: new Date(),
          }
        }
      );
      console.log('[PayDollar Webhook] Order marked Completed:', ref);
    } else {
      await db.collection('admindata').updateOne(
        { _id: new ObjectId(ref), status: { $ne: 'Completed' } },
        { $set: { status: 'Failed', failureReason: `src=${src} prc=${prc}`, updatedAt: new Date() } }
      );
    }

    return ACK();
  } catch (error: any) {
    console.error('[PayDollar Webhook Error]', error);
    // Ack anyway — we log the error ourselves; letting PayDollar retry a broken payload won't help.
    return ACK();
  }
}
