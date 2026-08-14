import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { renderPaymentReceiptEmailHtml, renderPaymentFailedEmailHtml } from '@/app/lib/emailTemplates';

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

    const body = await req.json();
    const { type, toEmail, customerName, companyName, orderId, planDetails, paymentMethodLabel } = body;

    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }
    if (type !== 'success' && type !== 'failed') {
      return NextResponse.json({ error: 'type must be "success" or "failed"' }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const name = (customerName || '').trim() || 'there';
    const fallbackOrderId = orderId || `MANUAL-${Date.now().toString(36).toUpperCase()}`;

    if (type === 'success') {
      const { amountUSD, paidAt } = body;
      if (amountUSD === undefined || amountUSD === null || isNaN(Number(amountUSD))) {
        return NextResponse.json({ error: 'amountUSD is required' }, { status: 400 });
      }

      await resend.emails.send({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        to: toEmail,
        subject: 'We received your QuickBooks Enterprise payment!',
        html: renderPaymentReceiptEmailHtml({
          customerName: name,
          toEmail,
          companyName,
          orderId: fallbackOrderId,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          amountUSD: Number(amountUSD),
          paymentMethodLabel: paymentMethodLabel || 'Card on file',
          planDetails,
        }),
      });
    } else {
      const { amountDueUSD, billingDate, cancellationDate, updateUrl } = body;
      if (amountDueUSD === undefined || amountDueUSD === null || isNaN(Number(amountDueUSD))) {
        return NextResponse.json({ error: 'amountDueUSD is required' }, { status: 400 });
      }
      if (!billingDate || !cancellationDate) {
        return NextResponse.json({ error: 'billingDate and cancellationDate are required' }, { status: 400 });
      }

      await resend.emails.send({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        to: toEmail,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        html: renderPaymentFailedEmailHtml({
          customerName: name,
          toEmail,
          companyName,
          orderId: fallbackOrderId,
          amountDueUSD: Number(amountDueUSD),
          paymentMethodLabel: paymentMethodLabel || 'the payment method on file',
          billingDate: new Date(billingDate),
          cancellationDate: new Date(cancellationDate),
          planDetails,
          updateUrl: updateUrl || undefined,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Send Custom Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
