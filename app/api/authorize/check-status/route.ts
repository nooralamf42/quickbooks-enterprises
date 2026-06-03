import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Polling endpoint — frontend calls this every 3 seconds to check
 * if the payment has been confirmed by the webhook.
 */
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('oid');
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne(
      { _id: new ObjectId(orderId) },
      { projection: { status: 1, fsOrderId: 1, paidAt: 1 } }
    );

    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: record.status,
      transactionId: record.fsOrderId || null,
      paidAt: record.paidAt || null
    });

  } catch (error: any) {
    console.error('[Check Status Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
