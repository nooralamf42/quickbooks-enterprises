import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Resend } from 'resend';
import crypto from 'crypto';
import { renderPaymentReceiptEmailHtml } from '@/app/lib/emailTemplates';

// Authorize.net pings this with GET to verify the endpoint is live before saving the webhook
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify Authorize.net webhook signature
    const signatureKey = process.env.AUTHORIZE_NET_SIGNATURE_KEY;
    if (signatureKey) {
      const authNetSig = req.headers.get('x-anet-signature');
      if (authNetSig) {
        const [, receivedHash] = authNetSig.split('=');
        const expectedHash = crypto
          .createHmac('sha512', signatureKey)
          .update(rawBody)
          .digest('hex')
          .toUpperCase();
        if (receivedHash?.toUpperCase() !== expectedHash) {
          console.error('[Webhook] Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    // If body is empty or non-JSON (e.g. Auth.net's verification ping), return 200 immediately
    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json({ received: true });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[Webhook] Non-JSON body received (likely a verification ping)');
      return NextResponse.json({ received: true });
    }

    console.log('[Webhook] Received event:', payload.eventType);

    // Only handle successful capture events
    const captureEvents = [
      'net.authorize.payment.authcapture.created',
      'net.authorize.payment.capture.created',
      'net.authorize.payment.priorAuthCapture.created'
    ];
    if (!captureEvents.includes(payload.eventType)) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const transactionId = payload.payload?.id;
    if (!transactionId) {
      console.error('[Webhook] No transaction ID in payload');
      return NextResponse.json({ error: 'No transaction ID' }, { status: 400 });
    }

    // Fetch full transaction details from Authorize.net to get the order description
    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
    const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';
    const endpoint = isProd
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const detailsRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        getTransactionDetailsRequest: {
          merchantAuthentication: { name: apiLoginId, transactionKey },
          transId: transactionId
        }
      })
    });
    const detailsData = await detailsRes.json();
    const transaction = detailsData?.transaction;

    if (!transaction) {
      console.error('[Webhook] Could not fetch transaction details for', transactionId);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Parse our orderId from the description field (we stored QB_ORDER:<orderId>)
    const description: string = transaction.order?.description || '';
    const match = description.match(/QB_ORDER:([a-f0-9]{24})/i);
    const localOrderId = match?.[1];

    console.log('[Webhook] transactionId:', transactionId, 'localOrderId:', localOrderId);

    if (!localOrderId) {
      console.warn('[Webhook] Could not parse localOrderId from description:', description);
      return NextResponse.json({ received: true, warning: 'No localOrderId found' });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });

    if (!record) {
      console.warn('[Webhook] Order not found:', localOrderId);
      return NextResponse.json({ received: true, warning: 'Order not found in DB' });
    }

    if (record.status === 'Completed') {
      console.log('[Webhook] Order already completed:', localOrderId);
      return NextResponse.json({ received: true, status: 'already_completed' });
    }

    // Update order to Completed
    const amountUSD = parseFloat(transaction.authAmount || record.amountUSD);
    await db.collection('admindata').updateOne(
      { _id: new ObjectId(localOrderId) },
      {
        $set: {
          status: 'Completed',
          fsOrderReference: `AUTHNET-${transactionId}`,
          fsOrderId: transactionId,
          gateway: 'Authorize.net',
          paidAt: new Date(),
          amountUSD,
          updatedAt: new Date()
        }
      }
    );

    console.log('[Webhook] Order marked Completed:', localOrderId);

    const card = transaction.payment?.creditCard;
    const paymentMethodLabel = card?.cardNumber
      ? `${card.cardType || 'Card'} ending in ${String(card.cardNumber).slice(-4)}`
      : 'Card on file';

    // Send success email
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const customerName = `${record.firstName} ${record.lastName}`.trim();

        await resend.emails.send({
          from: 'notifications@quickbooks-enterprises.com',
          to: 'info@qualitybusinesstech.us',
          subject: `New Successful Payment: $${amountUSD} from ${customerName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
              <h2 style="color: #2ca01c;">New Successful Payment (Authorize.net)</h2>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Customer:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${customerName}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Email:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.email}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Phone:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.phone || 'N/A'}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Company:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.companyName || 'N/A'}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Address:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.address}, ${record.city}, ${record.state} ${record.zipCode}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Plan:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.planDetails}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Amount:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#2ca01c;font-weight:bold;">$${amountUSD} USD</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Transaction ID:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${transactionId}</td></tr>
              </table>
            </div>
          `
        });
        console.log('[Webhook] Email sent for order:', localOrderId);

        if (record.email) {
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
              amountUSD,
              paymentMethodLabel,
              planDetails: record.planDetails,
            }),
          });
          console.log('[Webhook] Customer receipt sent for order:', localOrderId);
        }
      } catch (emailErr) {
        console.error('[Webhook] Email error:', emailErr);
      }
    }

    return NextResponse.json({ received: true, status: 'synced', localOrderId });

  } catch (error: any) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
