import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
import {
  renderPaymentReceiptEmailHtml,
  renderPaymentFailedEmailHtml,
  renderRefundEmailHtml,
  renderFeedbackEmailHtml,
  renderQueryEmailHtml,
} from '@/app/lib/emailTemplates';

/** Rebuilds the HTML of an email that was sent before the log started storing it, from the
 *  fields the log row does have. Approximate by design — the caller labels it "reconstructed".
 *  Anything the row doesn't carry (card, company, due date, license number...) comes from the
 *  matching admindata order when `orderId` is a real order id, otherwise it is left out or
 *  defaulted the same way the order-triggered sender defaults it. Returns null when there is
 *  nothing honest to rebuild (an 'other' row, or a 'query' row from before its text was saved). */
export async function reconstructEmailHtml(row: Record<string, any>): Promise<string | null> {
  const toEmail: string = row.toEmail || '';
  const customerName: string = (row.customerName || '').trim();
  const sentAt: Date = row.sentAt ? new Date(row.sentAt) : new Date();
  const amountUSD = Number(row.amountUSD) || 0;

  let record: Record<string, any> | null = null;
  if (row.orderId && ObjectId.isValid(row.orderId)) {
    try {
      const { db } = await connectToDatabase();
      record = await db.collection('admindata').findOne({ _id: new ObjectId(row.orderId) });
    } catch (err) {
      console.error('[EmailReconstruct] admindata lookup failed:', err);
    }
  }
  const companyName: string | undefined = record?.companyName || undefined;

  switch (row.type) {
    case 'receipt':
      return renderPaymentReceiptEmailHtml({
        customerName: customerName || 'there',
        toEmail,
        companyName,
        orderId: row.orderId || '',
        paidAt: record?.paidAt ? new Date(record.paidAt) : sentAt,
        amountUSD,
        paymentMethodLabel: record?.paymentMethodLabel || 'Card on file',
        planDetails: row.planDetails || record?.planDetails,
        licenseNumber: record?.licenseNumber || undefined,
        productNumber: record?.productNumber || undefined,
      });

    case 'reminder': {
      const dueDate = record?.paidAt ? new Date(record.paidAt) : sentAt;
      const cancellationDate = new Date(dueDate);
      cancellationDate.setDate(cancellationDate.getDate() + 7);
      return renderPaymentFailedEmailHtml({
        customerName: customerName || 'there',
        toEmail,
        companyName,
        orderId: row.orderId || '',
        amountDueUSD: amountUSD,
        paymentMethodLabel: record?.paymentMethodLabel || 'the payment method on file',
        dueDate,
        cancellationDate,
        planDetails: row.planDetails || record?.planDetails,
      });
    }

    case 'refund':
      return renderRefundEmailHtml({
        customerName: customerName || 'there',
        toEmail,
        companyName,
        orderId: row.orderId || '',
        refundedAt: sentAt,
        refundAmountUSD: amountUSD,
        paymentMethodLabel: record?.paymentMethodLabel || 'Card on file',
        planDetails: row.planDetails || record?.planDetails,
      });

    case 'survey':
      return renderFeedbackEmailHtml({ customerName: customerName === 'there' ? '' : customerName, toEmail, companyName });

    case 'query':
      if (!row.messageBody) return null;
      return renderQueryEmailHtml({
        customerName: customerName === 'there' ? '' : customerName,
        toEmail,
        companyName,
        subject: row.subject || '',
        bodyText: row.messageBody,
      });

    default:
      return null;
  }
}
