import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { sendPaymentNotificationEmail } from '@/app/lib/paymentNotification';

export async function POST(req: NextRequest) {
  try {
    const { transactionId, localOrderId } = await req.json();

    if (!transactionId || !localOrderId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';

    if (!apiLoginId || !transactionKey) {
      return NextResponse.json({ error: 'Authorize.net credentials missing' }, { status: 500 });
    }

    const endpoint = isProd 
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const verifyBody = {
      getTransactionDetailsRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey
        },
        transId: transactionId
      }
    };

    const fsResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyBody),
    });

    const data = await fsResponse.json();

    if (data.messages.resultCode !== 'Ok' || !data.transaction) {
      return NextResponse.json({ error: 'Transaction not found or invalid' }, { status: 404 });
    }

    const transaction = data.transaction;
    
    // Check if it's captured/approved
    if (transaction.responseCode !== 1) { // 1 = Approved
      return NextResponse.json({ status: 'pending', message: 'Transaction not approved' });
    }

    const { db } = await connectToDatabase();

    // Internal notification, not the customer receipt (sent manually from the admin
    // dashboard) — shared with every other gateway's webhook.
    const sendSuccessEmail = async (record: any, transactionId: string) => {
      await sendPaymentNotificationEmail({
        gatewayLabel: 'Authorize.net',
        customerName: `${record.firstName} ${record.lastName}`.trim(),
        email: record.email,
        phone: record.phone,
        companyName: record.companyName,
        address: record.address,
        city: record.city,
        state: record.state,
        zipCode: record.zipCode,
        country: record.country,
        planDetails: record.planDetails,
        amountUSD: record.amountUSD,
        transactionId,
      });
    };

    try {
      const existingRecord = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });
      
      if (existingRecord) {
        if (existingRecord.status === 'Completed') {
          return NextResponse.json({ status: 'already_synced' });
        }

        const amountUSD = parseFloat(transaction.authAmount || existingRecord.amountUSD);

        const card = transaction.payment?.creditCard;
        const cardLast4 = card?.cardNumber ? String(card.cardNumber).slice(-4) : undefined;
        const cardType = card?.cardType || undefined;
        const paymentMethodLabel = cardLast4
          ? `${cardType || 'Card'} ending in ${cardLast4}`
          : 'Card on file';

        await db.collection('admindata').updateOne(
          { _id: new ObjectId(localOrderId) },
          {
            $set: {
              status: 'Completed',
              fsOrderReference: `AUTHNET-${transactionId}`, // We use this field for the PDF/Receipt
              fsOrderId: transactionId,
              gateway: 'Authorize.net',
              paidAt: new Date(),
              amountUSD: amountUSD,
              cardType,
              cardLast4,
              paymentMethodLabel,
            }
          }
        );

        await sendSuccessEmail(existingRecord, transactionId);

        return NextResponse.json({ status: 'synced', localOrderId });
      }
    } catch (e) {
      console.warn('[Sync Order] localOrderId was invalid or not found');
      return NextResponse.json({ error: 'Local order not found' }, { status: 404 });
    }

  } catch (error: any) {
    console.error('[Sync Order Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
