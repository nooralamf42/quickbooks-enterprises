import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Resend } from 'resend';
import { renderPaymentReceiptEmailHtml, renderPaymentFailedEmailHtml } from '@/app/lib/emailTemplates';
import { logEmailSent } from '@/app/lib/emailLog';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

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

    const resend = new Resend(process.env.RESEND_API_KEY);
    const customerName = `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'there';

    if (type === 'success') {
      const { data } = await resend.emails.send({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        // notifications@ has no mailbox and no receiving MX — without this, a customer
        // reply either bounces or silently vanishes. billing@ is the one that's monitored.
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

      await logEmailSent({
        type: 'receipt',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'We received your QuickBooks Enterprise payment!',
        trigger: 'admin-order',
        resendId: data?.id,
      });
    } else {
      const billingDate = record.paidAt ? new Date(record.paidAt) : new Date();
      const cancellationDate = new Date(billingDate);
      cancellationDate.setDate(cancellationDate.getDate() + 7);

      const { data } = await resend.emails.send({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        // notifications@ has no mailbox and no receiving MX — without this, a customer
        // reply either bounces or silently vanishes. billing@ is the one that's monitored.
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
          billingDate,
          cancellationDate,
          planDetails: record.planDetails,
        }),
      });

      await logEmailSent({
        type: 'reminder',
        toEmail: record.email,
        customerName,
        orderId: record._id.toString(),
        planDetails: record.planDetails,
        amountUSD: record.amountUSD || 0,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        trigger: 'admin-order',
        resendId: data?.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Send Order Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
