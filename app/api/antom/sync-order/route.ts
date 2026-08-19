import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { inquiryPayment } from '@/app/lib/antom';

export async function POST(req: NextRequest) {
  try {
    const { localOrderId } = await req.json();

    if (!localOrderId || !ObjectId.isValid(localOrderId)) {
      return NextResponse.json({ error: 'Missing or invalid localOrderId' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (record.status === 'Completed') {
      return NextResponse.json({ status: 'already_synced' });
    }

    const inquiryRes = await inquiryPayment({ paymentRequestId: localOrderId });

    if (!inquiryRes.ok) {
      return NextResponse.json({ status: 'pending', message: 'Could not reach Antom' });
    }

    const data = inquiryRes.data;
    if (data?.result?.resultStatus !== 'S') {
      return NextResponse.json({ status: 'pending', message: data?.result?.resultMessage || 'Payment not completed yet' });
    }

    const amountUSD = data.paymentAmount?.value
      ? Number(data.paymentAmount.value) / 100
      : record.amountUSD;

    await db.collection('admindata').updateOne(
      { _id: new ObjectId(localOrderId) },
      {
        $set: {
          status: 'Completed',
          fsOrderReference: `ANTOM-${data.paymentId}`,
          fsOrderId: data.paymentId,
          gateway: 'Antom',
          paidAt: new Date(),
          amountUSD,
          paymentMethodLabel: data.paymentMethodType || 'Card on file',
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({ status: 'synced', localOrderId });
  } catch (error: any) {
    console.error('[Antom Sync Order Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
