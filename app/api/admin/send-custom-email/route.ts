import { NextRequest, NextResponse } from 'next/server';
// import { Resend } from 'resend'; // STOPGAP: commented while the Resend account is
// under review (suspended 2026-08-25). Restore this import when reactivated.
import { sendEmail } from '@/app/lib/emailSender';
import { renderPaymentReceiptEmailHtml, renderPaymentFailedEmailHtml } from '@/app/lib/emailTemplates';
import { logEmailSent } from '@/app/lib/emailLog';
import { sendPaymentNotificationEmail } from '@/app/lib/paymentNotification';

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

    const body = await req.json();
    const { type, toEmail, customerName, companyName, orderId, planDetails, paymentMethodLabel, licenseNumber, productNumber, numUsers, contractYears } = body;

    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }
    if (type !== 'success' && type !== 'failed') {
      return NextResponse.json({ error: 'type must be "success" or "failed"' }, { status: 400 });
    }

    // const resend = new Resend(process.env.RESEND_API_KEY); // STOPGAP: see sendEmail() below — dispatches to Postmark or MailerSend, switchable from the admin panel.
    const name = (customerName || '').trim() || 'there';
    const fallbackOrderId = orderId || `MANUAL-${Date.now().toString(36).toUpperCase()}`;

    if (type === 'success') {
      const { amountUSD, paidAt, dueDate } = body;
      if (amountUSD === undefined || amountUSD === null || isNaN(Number(amountUSD))) {
        return NextResponse.json({ error: 'amountUSD is required' }, { status: 400 });
      }

      // STOPGAP: original Resend call, restore when the account is reactivated —
      // const { data } = await resend.emails.send({
      //   from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'billing@quickbooks-enterprises.com',
      //   to: toEmail,
      //   subject: 'We received your QuickBooks Enterprise payment!',
      //   html: renderPaymentReceiptEmailHtml({ ... }),
      // });
      const { data, error, provider } = await sendEmail({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        replyTo: 'billing@quickbooks-enterprises.com',
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
          licenseNumber: licenseNumber || undefined,
          productNumber: productNumber || undefined,
          numUsers: numUsers !== undefined && numUsers !== null && numUsers !== '' ? Number(numUsers) : undefined,
          contractYears: contractYears !== undefined && contractYears !== null && contractYears !== '' ? Number(contractYears) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        }),
      });

      // Pre-existing gap, not new to this Postmark swap: this route never checked the
      // provider's error before, so a rejected send still returned { success: true }.
      // Surfacing it now since Postmark's sandbox mode (pending approval) makes rejections
      // routine rather than rare.
      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'receipt',
        toEmail,
        customerName: name,
        orderId: fallbackOrderId,
        planDetails,
        amountUSD: Number(amountUSD),
        subject: 'We received your QuickBooks Enterprise payment!',
        trigger: 'admin-manual',
        providerMessageId: data?.id,
        provider,
      });

      // Internal "confirmation" alert — same one every gateway's webhook sends on a real
      // payment, so a manually-sent receipt notifies the business the same way.
      await sendPaymentNotificationEmail({
        gatewayLabel: 'Manual Send',
        customerName: name,
        email: toEmail,
        companyName,
        planDetails,
        amountUSD: Number(amountUSD),
        transactionId: fallbackOrderId,
        transactionIdLabel: 'Order ID',
      });
    } else {
      const { amountDueUSD, cancellationDate, updateUrl, dueDate } = body;
      if (amountDueUSD === undefined || amountDueUSD === null || isNaN(Number(amountDueUSD))) {
        return NextResponse.json({ error: 'amountDueUSD is required' }, { status: 400 });
      }
      if (!cancellationDate || !dueDate) {
        return NextResponse.json({ error: 'cancellationDate and dueDate are required' }, { status: 400 });
      }

      // STOPGAP: original Resend call, restore when the account is reactivated —
      // const { data } = await resend.emails.send({
      //   from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
      //   // notifications@ has no mailbox and no receiving MX — without this, a customer
      //   // reply either bounces or silently vanishes. billing@ is the one that's monitored.
      //   replyTo: 'billing@quickbooks-enterprises.com',
      //   to: toEmail,
      //   subject: 'Action needed: update your QuickBooks Enterprise payment method',
      //   html: renderPaymentFailedEmailHtml({ ... }),
      // });
      const { data, error, provider } = await sendEmail({
        from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
        replyTo: 'billing@quickbooks-enterprises.com',
        to: toEmail,
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        html: renderPaymentFailedEmailHtml({
          customerName: name,
          toEmail,
          companyName,
          orderId: fallbackOrderId,
          amountDueUSD: Number(amountDueUSD),
          paymentMethodLabel: paymentMethodLabel || 'the payment method on file',
          cancellationDate: new Date(cancellationDate),
          dueDate: new Date(dueDate),
          planDetails,
          numUsers: numUsers !== undefined && numUsers !== null && numUsers !== '' ? Number(numUsers) : undefined,
          contractYears: contractYears !== undefined && contractYears !== null && contractYears !== '' ? Number(contractYears) : undefined,
          updateUrl: updateUrl || undefined,
        }),
      });

      if (error) {
        return NextResponse.json({ error: error.message || 'Email provider rejected the send' }, { status: 502 });
      }

      await logEmailSent({
        type: 'reminder',
        toEmail,
        customerName: name,
        orderId: fallbackOrderId,
        planDetails,
        amountUSD: Number(amountDueUSD),
        subject: 'Action needed: update your QuickBooks Enterprise payment method',
        trigger: 'admin-manual',
        providerMessageId: data?.id,
        provider,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Send Custom Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
