import { sendViaZeptoMail } from '@/app/lib/zeptomail';

/** The internal "New Successful Payment" alert sent to the business's own inbox on every
 *  completed payment — distinct from the customer-facing receipt, which is sent manually
 *  from the admin dashboard. Originally only wired up for Authorize.net; this is the shared
 *  version every gateway's webhook calls, so a gateway can't go live without also alerting
 *  the business the way Authorize.net already did.
 *
 *  Deliberately hardcoded to ZeptoMail rather than the switchable sendEmail() dispatcher —
 *  ZeptoMail is confirmed working for this specific internal alert, and this notification
 *  shouldn't silently move to whatever a manual-send provider toggle picks (e.g. Postwing)
 *  for the Send Email tab. The two are intentionally decoupled. */

export interface PaymentNotificationParams {
  /** Shown in the email heading, e.g. "New Successful Payment (Stripe)". */
  gatewayLabel: string;
  customerName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  planDetails?: string;
  amountUSD: number;
  /** e.g. Authorize.net transaction id, Stripe PaymentIntent id, Shopify order id. */
  transactionId: string;
  transactionIdLabel?: string;
}

function row(label: string, value?: string | number): string {
  if (value === undefined || value === null || value === '') return '';
  return `<tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>${label}:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${value}</td></tr>`;
}

export async function sendPaymentNotificationEmail(params: PaymentNotificationParams): Promise<void> {
  const {
    gatewayLabel, customerName, email, phone, companyName,
    address, city, state, zipCode, country, planDetails,
    amountUSD, transactionId, transactionIdLabel = 'Transaction ID',
  } = params;

  const addressLine = [address, [city, state, zipCode].filter(Boolean).join(', '), country]
    .filter(Boolean)
    .join(', ');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
      <h2 style="color: #2ca01c;">New Successful Payment (${gatewayLabel})</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        ${row('Customer', customerName)}
        ${row('Email', email)}
        ${row('Phone', phone)}
        ${row('Company', companyName)}
        ${row('Address', addressLine)}
        ${row('Plan', planDetails)}
        <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Amount:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#2ca01c;font-weight:bold;">$${amountUSD} USD</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>${transactionIdLabel}:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${transactionId}</td></tr>
      </table>
    </div>
  `;

  try {
    const { error } = await sendViaZeptoMail({
      from: 'notifications@quickbooks-enterprises.com',
      to: 'info@qualitybusinesstech.us',
      subject: `New Successful Payment: $${amountUSD} from ${customerName}`,
      html,
    });
    if (error) console.error(`[PaymentNotification] Email rejected (${gatewayLabel}):`, error.message);
  } catch (err) {
    console.error(`[PaymentNotification] Email error (${gatewayLabel}):`, err);
  }
}
