import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyNotifySignature } from '@/app/lib/antom';

const ACK = NextResponse.json({
  result: { resultCode: 'SUCCESS', resultStatus: 'S', resultMessage: 'Success' }
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const clientId = req.headers.get('client-id') || '';
    const requestTime = req.headers.get('request-time') || '';
    const signatureHeader = req.headers.get('signature') || '';

    const isValid = verifyNotifySignature({
      pathname: req.nextUrl.pathname,
      clientId,
      requestTime,
      signatureHeader,
      rawBody,
    });

    if (!isValid) {
      console.error('[Antom Webhook] Invalid signature, ignoring notification');
      // Still ack with 200 so Antom doesn't hammer us with retries for a payload we'll never trust.
      return ACK;
    }

    const payload = JSON.parse(rawBody);

    if (payload.notifyType !== 'PAYMENT_RESULT') {
      return ACK;
    }

    const localOrderId = payload.paymentRequestId;
    if (!localOrderId || !ObjectId.isValid(localOrderId)) {
      console.warn('[Antom Webhook] No valid paymentRequestId in notification');
      return ACK;
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

    if (!record) {
      console.warn('[Antom Webhook] Order not found:', localOrderId);
      return ACK;
    }

    if (record.status === 'Completed') {
      return ACK;
    }

    if (payload.result?.resultStatus === 'S') {
      const amountUSD = payload.paymentAmount?.value
        ? Number(payload.paymentAmount.value) / 100
        : record.amountUSD;

      await db.collection('admindata').updateOne(
        { _id: new ObjectId(localOrderId) },
        {
          $set: {
            status: 'Completed',
            fsOrderReference: `ANTOM-${payload.paymentId}`,
            fsOrderId: payload.paymentId,
            gateway: 'Antom',
            paidAt: new Date(),
            amountUSD,
            paymentMethodLabel: payload.paymentMethodType || 'Card on file',
            updatedAt: new Date(),
          }
        }
      );
      console.log('[Antom Webhook] Order marked Completed:', localOrderId);
    }

    return ACK;
  } catch (error: any) {
    console.error('[Antom Webhook Error]', error);
    // Ack anyway — we log the error ourselves; letting Antom retry a broken payload won't help.
    return ACK;
  }
}
