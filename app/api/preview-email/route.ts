import { NextResponse } from 'next/server';
import { renderPaymentReceiptEmailHtml } from '@/app/lib/emailTemplates';

export async function GET() {
  const html = renderPaymentReceiptEmailHtml({
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
