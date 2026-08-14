import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Resend } from 'resend';
import { renderPaymentReceiptEmailHtml } from '@/app/lib/emailTemplates';

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

    const sendSuccessEmail = async (record: any, transactionId: string) => {
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const customerName = `${record.firstName} ${record.lastName}`.trim();
          
          await resend.emails.send({
            from: 'notifications@quickbooks-enterprises.com',
            to: 'info@qualitybusinesstech.us',
            subject: `New Successful Payment: $${record.amountUSD} from ${customerName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-w-2xl mx-auto; color: #333;">
                <h2 style="color: #2ca01c;">New Successful Payment (Authorize.net)</h2>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Customer Name:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.phone || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Company:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.companyName || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Billing Address:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                      ${record.address}<br>
                      ${record.city}, ${record.state} ${record.zipCode}<br>
                      ${record.country}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Plan Details:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.planDetails}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount Paid:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #2ca01c;">$${record.amountUSD} USD</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Transaction ID:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${transactionId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>IP Address:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.ipAddress || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Device/Browser:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.deviceType || 'Unknown'} - ${record.browser || 'Unknown'}</td>
                  </tr>
                </table>
                
                <p style="margin-top: 30px; font-size: 12px; color: #888;">
                  This notification was automatically generated by your QuickBooks Enterprise payment portal.
                </p>
              </div>
            `
          });

          if (record.email) {
            const card = transaction.payment?.creditCard;
            const paymentMethodLabel = card?.cardNumber
              ? `${card.cardType || 'Card'} ending in ${String(card.cardNumber).slice(-4)}`
              : 'Card on file';

            await resend.emails.send({
              from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
              to: record.email,
              subject: `We received your QuickBooks Enterprise payment!`,
              html: renderPaymentReceiptEmailHtml({
                customerName,
                toEmail: record.email,
                companyName: record.companyName,
                orderId: localOrderId,
                paidAt: new Date(),
                amountUSD: record.amountUSD,
                paymentMethodLabel,
                planDetails: record.planDetails,
              }),
            });
          }
        } catch (e) {
          console.error('[Sync Order] Failed to send Resend email', e);
        }
      }
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
