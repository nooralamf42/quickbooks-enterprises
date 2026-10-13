import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { queryPaydollarOrder } from '@/app/lib/paydollar';

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

    const query = await queryPaydollarOrder(localOrderId);

    if (!query) {
      return NextResponse.json({ status: 'pending', message: 'Could not reach PayDollar' });
    }

    if (query.successcode !== '0') {
      return NextResponse.json({ status: 'pending', message: query.errMsg || 'Payment not completed yet' });
    }

    const amountUSD = query.amt ? Number(query.amt) : record.amountUSD;

    await db.collection('admindata').updateOne(
      { _id: new ObjectId(localOrderId) },
      {
        $set: {
          status: 'Completed',
          fsOrderReference: `PAYDOLLAR-${query.payRef}`,
          fsOrderId: query.payRef,
          gateway: 'PayDollar',
          paidAt: new Date(),
          amountUSD,
          paymentMethodLabel: 'Card on file',
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({ status: 'synced', localOrderId });
  } catch (error: any) {
    console.error('[PayDollar Sync Order Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
