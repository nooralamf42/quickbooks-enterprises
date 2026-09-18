import { NextRequest, NextResponse } from 'next/server';
import { renderPaymentReceiptEmailHtml, renderRefundEmailHtml } from '@/app/lib/emailTemplates';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  const html = type === 'refund'
    ? renderRefundEmailHtml({
      customerName: 'Noor Alam',
      toEmail: 'noor@example.com',
      companyName: 'Acme Corp',
      orderId: 'ORD-123456',
      refundedAt: new Date(),
      refundAmountUSD: 100.00,
      paymentMethodLabel: 'Visa ending in 4242',
      planDetails: 'PAYROLL Service',
      reason: 'Customer requested cancellation',
    })
    : renderPaymentReceiptEmailHtml({
      customerName: 'Noor Alam',
      toEmail: 'noor@example.com',
      companyName: 'Acme Corp',
      orderId: 'ORD-123456',
      paidAt: new Date(),
      amountUSD: 100.00,
      paymentMethodLabel: 'Visa ending in 4242',
      planDetails: 'PAYROLL Service'
    });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
