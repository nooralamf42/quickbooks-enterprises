import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
// import { Resend } from 'resend'; // STOPGAP: commented while the Resend account is
// under review (suspended 2026-08-25). Restore this import when reactivated.
import { sendViaPostmark } from '@/app/lib/postmark';
import { renderPaymentReceiptEmailHtml, renderPaymentFailedEmailHtml } from '@/app/lib/emailTemplates';
import { logEmailSent } from '@/app/lib/emailLog';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    // if (!process.env.RESEND_API_KEY) { // STOPGAP: no upfront token guard — a missing
    //   return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 }); // token now surfaces per-send from sendEmail() itself, whichever provider is active.
    // }

    const { id, type } = await req.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }
    if (type !== 'success' && type !== 'failed') {
      return NextResponse.json({ error: 'type must be "success" or "failed"' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const record = await db.collection('admindata').findOne({ _id: new ObjectId(id) });

    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!record.email) {
      return NextResponse.json({ error: 'Order has no email on file' }, { status: 400 });
    }

    // const resend = new Resend(process.env.RESEND_API_KEY); // STOPGAP: see sendViaPostmark() below.
    // Order-triggered sends are Postmark-only — no provider switch here. SMTP2GO was
    // permanently banned and removed; MailerSend is scoped to the manual Send Email tab only.
    const customerName = `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'there';

    if (type === 'success') {
      // STOPGAP: original Resend call, restore when the account is reactivated —
      // const { data } = await resend.emails.send({
      //   from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'billing@quickbooks-enterprises.com',
      //   to: record.email,
      //   subject: 'We received your QuickBooks Enterprise payment!',
      //   html: renderPaymentReceiptEmailHtml({ ... }),
      // });
      const { data, error } = await sendViaPostmark({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        replyTo: 'billing@quickbooks-enterprises.com',
        to: record.email,
        subject: 'We received your QuickBooks Enterprise payment!',
        html: renderPaymentReceiptEmailHtml({
          customerName,
          toEmail: record.email,
          companyName: record.companyName,
          orderId: record._id.toString(),
          paidAt: record.paidAt ? new Date(record.paidAt) : new Date(),
          amountUSD: record.amountUSD || 0,
          paymentMethodLabel: record.paymentMethodLabel || 'Card on file',
          planDetails: record.planDetails,
          licenseNumber: record.licenseNumber || undefined,
          productNumber: record.productNumber || undefined,
        }),
      });

      // Pre-existing gap, not new to this Postmark swap: this route never checked the
      // provider's error before, so a rejected send still returned { success: true }.
      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'receipt',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'We received your QuickBooks Enterprise payment!',
        trigger: 'admin-order',
        providerMessageId: data?.id,
        provider: 'postmark',
      });
      // No internal payment-notification alert here on purpose — this order was already
      // paid (that's why it exists), so resending its receipt isn't a new payment event
      // and shouldn't re-notify the business as if one just happened.
    } else {
      const dueDate = record.paidAt ? new Date(record.paidAt) : new Date();
      const cancellationDate = new Date(dueDate);
      cancellationDate.setDate(cancellationDate.getDate() + 7);

      // STOPGAP: original Resend call, restore when the account is reactivated —
      // const { data } = await resend.emails.send({
      //   from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'billing@quickbooks-enterprises.com',
      //   to: record.email,
      //   subject: 'Action needed: update your QuickBooks Enterprise payment method',
      //   html: renderPaymentFailedEmailHtml({ ... }),
      // });
      const { data, error } = await sendViaPostmark({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        replyTo: 'billing@quickbooks-enterprises.com',
        to: record.email,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        html: renderPaymentFailedEmailHtml({
          customerName,
          toEmail: record.email,
          companyName: record.companyName,
          orderId: record._id.toString(),
          amountDueUSD: record.amountUSD || 0,
          paymentMethodLabel: record.paymentMethodLabel || 'the payment method on file',
          dueDate,
          cancellationDate,
          planDetails: record.planDetails,
        }),
      });

      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'reminder',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        trigger: 'admin-order',
        providerMessageId: data?.id,
        provider: 'postmark',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Send Order Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
