import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyWebhookHmac, formatCardLabel } from '@/app/lib/shopify';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');

    if (!verifyWebhookHmac(rawBody, hmacHeader)) {
      console.error('[Shopify Webhook] Invalid HMAC, ignoring');
      return NextResponse.json({ ok: true });
    }

    if (topic !== 'orders/paid' && topic !== 'orders/create') {
      return NextResponse.json({ ok: true });
    }

    const order = JSON.parse(rawBody);
    if (order.financial_status !== 'paid') {
      return NextResponse.json({ ok: true });
    }

    const noteAttrs: { name: string; value: string }[] = order.note_attributes || [];
    const localOrderId = noteAttrs.find((a) => a.name === 'localOrderId')?.value;

    if (!localOrderId || !ObjectId.isValid(localOrderId)) {
      console.warn('[Shopify Webhook] No valid localOrderId note attribute on order', order.id);
      return NextResponse.json({ ok: true });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

    if (!record || record.status === 'Completed') {
      return NextResponse.json({ ok: true });
    }

    const cardNumber: string | undefined = order.payment_details?.credit_card_number;
    const cardCompany: string | undefined = order.payment_details?.credit_card_company;
    const paymentMethodLabel = formatCardLabel(cardCompany, cardNumber);

    await db.collection('admindata').updateOne(
      { _id: new ObjectId(localOrderId) },
      {
        $set: {
          status: 'Completed',
          fsOrderReference: `SHOPIFY-${order.name}`,
          fsOrderId: order.admin_graphql_api_id || String(order.id),
          shopifyOrderNumericId: String(order.id),
          gateway: record.paymentGateway || 'Shopify',
          paidAt: new Date(),
          amountUSD: Number(order.total_price),
          cardType: cardCompany,
          cardLast4: cardNumber?.match(/(\d{4})\s*$/)?.[1],
          paymentMethodLabel,
          updatedAt: new Date(),
        }
      }
    );

    console.log('[Shopify Webhook] Order marked Completed:', localOrderId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Shopify Webhook Error]', error);
    return NextResponse.json({ ok: true });
  }
}
