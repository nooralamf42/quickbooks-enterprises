import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyWebhookHmac, formatCardLabel, adminGraphQL } from '@/app/lib/shopify';
import { sendPaymentNotificationEmail } from '@/app/lib/paymentNotification';

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

    // The REST payload's payment_details field is unreliable (frequently absent depending
    // on payment method/gateway), so fetch the real card details via GraphQL instead —
    // the same approach that already works reliably in sync-order.
    let cardCompany: string | undefined = order.payment_details?.credit_card_company;
    let cardNumber: string | undefined = order.payment_details?.credit_card_number;

    if (!cardNumber) {
      const orderGid = order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`;
      const txResult = await adminGraphQL<{
        node: { transactions: { kind: string; status: string; paymentDetails: { company?: string; number?: string } | null }[] } | null;
      }>(
        `query($id: ID!) {
          node(id: $id) {
            ... on Order {
              transactions(first: 5) {
                kind
                status
                paymentDetails { ... on CardPaymentDetails { company number } }
              }
            }
          }
        }`,
        { id: orderGid }
      );

      const cardTransaction = txResult.data?.node?.transactions?.find(
        (t) => (t.kind === 'SALE' || t.kind === 'CAPTURE') && t.status === 'SUCCESS' && t.paymentDetails
      );
      cardCompany = cardTransaction?.paymentDetails?.company;
      cardNumber = cardTransaction?.paymentDetails?.number;
    }

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

    await sendPaymentNotificationEmail({
      gatewayLabel: 'Shopify',
      customerName: `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unknown',
      email: record.email,
      phone: record.phone,
      companyName: record.companyName,
      address: record.address,
      city: record.city,
      state: record.state,
      zipCode: record.zipCode,
      country: record.country,
      planDetails: record.planDetails,
      amountUSD: Number(order.total_price),
      transactionId: order.name,
      transactionIdLabel: 'Order',
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Shopify Webhook Error]', error);
    return NextResponse.json({ ok: true });
  }
}
