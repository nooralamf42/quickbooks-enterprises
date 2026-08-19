import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { findOrderByLocalOrderId } from '@/app/lib/shopify';

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

    const result = await findOrderByLocalOrderId(localOrderId);
    if (!result.ok) {
      return NextResponse.json({ status: 'pending', message: 'Could not reach Shopify' });
    }

    const order = result.data?.orders.edges[0]?.node;
    if (!order || order.displayFinancialStatus !== 'PAID') {
      return NextResponse.json({ status: 'pending', message: 'Order not paid yet' });
    }

    await db.collection('admindata').updateOne(
      { _id: new ObjectId(localOrderId) },
      {
        $set: {
          status: 'Completed',
          fsOrderReference: `SHOPIFY-${order.name}`,
          fsOrderId: order.id,
          gateway: 'Shopify',
          paidAt: new Date(),
          amountUSD: Number(order.totalPriceSet.shopMoney.amount),
          paymentMethodLabel: 'Card on file',
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({ status: 'synced', localOrderId });
  } catch (error: any) {
    console.error('[Shopify Sync Order Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
