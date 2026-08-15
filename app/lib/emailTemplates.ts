// Shared transactional email templates, styled to match the polished look
// of Intuit's own account emails: dark header bar, a status icon, a
// bordered detail card, and a dark footer. Branding (logo, colors, legal
// copy) is our own — we render this, we don't proxy Intuit's.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com';
const BRAND_NAVY = '#00254a';
const BRAND_GREEN = '#2ca01c';

// Hosted (not data-URI) so Gmail and other clients that strip inline
// base64 images still render them — same technique as the header logo.
const SUCCESS_ICON_URL = `${BASE_URL}/email-success-check.svg`;
const ALERT_ICON_URL = `${BASE_URL}/email-alert.svg`;

const SUPPORT_MAILTO = 'mailto:billing@quickbooks-enterprises.com';
const SUPPORT_TEL = 'tel:+18888298848';

// Wraps a body fragment as a full HTML document. The color-scheme meta tags
// cover Apple Mail/Outlook.com, but Gmail's mobile apps ignore them and use
// their own heuristic instead: when Gmail auto-dark-modes a message it
// stamps `data-ogsc`/`data-ogsb` on the content, then repaints near-white
// backgrounds and near-black text to dark/light — while usually leaving
// strongly saturated brand colors (our navy/green) alone. The <style>
// block below targets Gmail's marker directly and forces our real colors
// back with !important, which is the standard workaround for this since
// inline styles/attributes alone can't be selectively overridden.
function wrapEmailDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
  [data-ogsc] [bgcolor="${BRAND_NAVY}"], [data-ogsc][bgcolor="${BRAND_NAVY}"] { background-color: ${BRAND_NAVY} !important; }
  [data-ogsc] [bgcolor="#F4F4EF"], [data-ogsc][bgcolor="#F4F4EF"] { background-color: #F4F4EF !important; }
  [data-ogsc] [bgcolor="#ffffff"], [data-ogsc][bgcolor="#ffffff"] { background-color: #ffffff !important; }
  [data-ogsc] [bgcolor="#EFF4F9"], [data-ogsc][bgcolor="#EFF4F9"] { background-color: #EFF4F9 !important; }
  [data-ogsc] [bgcolor="${BRAND_GREEN}"], [data-ogsc][bgcolor="${BRAND_GREEN}"] { background-color: ${BRAND_GREEN} !important; }
  [data-ogsc] [bgcolor="#21262A"], [data-ogsc][bgcolor="#21262A"] { background-color: #21262A !important; }
  [data-ogsc] [style*="background-color:#f4f5f8"], [data-ogsc][style*="background-color:#f4f5f8"] { background-color: #f4f5f8 !important; }
  [data-ogsc] [style*="background-color:#f4f4ef"], [data-ogsc][style*="background-color:#f4f4ef"] { background-color: #f4f4ef !important; }
  [data-ogsc] [style*="background-color:#ffffff"], [data-ogsc][style*="background-color:#ffffff"] { background-color: #ffffff !important; }
  [data-ogsc] [style*="background-color:${BRAND_NAVY}"], [data-ogsc][style*="background-color:${BRAND_NAVY}"] { background-color: ${BRAND_NAVY} !important; }
  [data-ogsc] [style*="color:#000000"], [data-ogsc][style*="color:#000000"] { color: #000000 !important; }
  [data-ogsc] [style*="color:#555555"], [data-ogsc][style*="color:#555555"] { color: #555555 !important; }
  [data-ogsc] body, body[data-ogsc] { background-color: #f4f5f8 !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f8">
${bodyHtml}
</body>
</html>`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function detailRow(label: string, value: string, first = false, labelWidth = 200) {
  return `
    <tr>
      <td style="${first ? '' : 'padding-top:6px;'}">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" valign="top" width="${labelWidth}" style="font-family:Avenir,Arial,sans-serif;font-size:16px;font-weight:600;line-height:24px;text-align:left;color:#000000">
              ${label}
            </td>
            <td width="20" style="width:20px">&nbsp;</td>
            <td align="left" valign="top" style="font-family:Avenir,Arial,sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#000000">
              ${value}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function emailHeader(): string {
  const logoUrl = `${BASE_URL}/email-logo.png`;
  // White-wordmark/green-icon variant (724x241, ~3.0:1) made for dark
  // backgrounds — unlike quickbooks_logo.png (solid black, unreadable on
  // navy). Served as PNG, not WebP: several mail clients (including
  // Gmail's own image proxy) fail to decode WebP correctly and render
  // corrupted/garbled pixels instead of a clean image.
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" align="center" bgcolor="${BRAND_NAVY}" style="width:100%;max-width:660px;text-align:center;background-color:${BRAND_NAVY}">
      <tr>
        <td height="90" align="center" bgcolor="${BRAND_NAVY}" style="background-color:${BRAND_NAVY};height:90px">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" align="center" bgcolor="${BRAND_NAVY}" style="width:100%;max-width:580px;margin:0 auto;background-color:${BRAND_NAVY}">
            <tr>
              <td align="left" valign="middle" bgcolor="${BRAND_NAVY}" style="text-align:left;padding:15px 0;background-color:${BRAND_NAVY}">
                <img src="${logoUrl}" alt="QuickBooks Enterprise" width="144" height="48" style="display:inline-block;vertical-align:middle;border:0;width:144px;height:48px">
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function orderDetailsSection(companyName: string, orderId: string, planDetails?: string): string {
  return `
    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:660px" bgcolor="#ffffff">
      <tr>
        <td>
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:580px">
            <tr>
              <td valign="top" align="left" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:26px;font-weight:600;padding-top:40px;padding-bottom:20px;color:#000000">
                Order details
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:580px">
            <tr>
              <td align="left" valign="top" width="240" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:600;color:#000000">Billed to:</td>
              <td width="20" style="width:20px">&nbsp;</td>
              <td valign="top" align="left" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:400;color:#000000">${escapeHtml(companyName)}</td>
            </tr>
            <tr>
              <td align="left" valign="top" width="240" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:600;padding-top:8px;color:#000000">Order ID:</td>
              <td width="20" style="width:20px">&nbsp;</td>
              <td align="left" valign="top" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:400;padding-top:8px;color:#000000">${escapeHtml(orderId)}</td>
            </tr>
            ${planDetails ? `
            <tr>
              <td align="left" valign="top" width="240" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:600;padding-top:8px;color:#000000">Items on this order:</td>
              <td width="20" style="width:20px">&nbsp;</td>
              <td align="left" valign="top" style="font-family:Avenir,Arial,sans-serif;text-align:left;font-size:16px;line-height:24px;font-weight:400;padding-top:8px;color:#000000">${escapeHtml(planDetails)}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table align="center" bgcolor="#ffffff" width="100%" cellspacing="0" cellpadding="0" border="0" style="text-align:center;width:100%;max-width:580px;color:#000000;padding-top:40px">
            <tr>
              <td style="font-size:12px;line-height:16px;font-weight:400;font-family:Avenir,Arial,sans-serif;text-align:left;color:#555555" align="left">
                Intuit, QuickBooks, QuickBooks ProAdvisor and logo are registered trademarks of Intuit Inc. Used here with permission under the QuickBooks ProAdvisor Agreement. Terms and conditions, features, support, pricing, and service options are subject to change without notice.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function supportBox(heading = 'Questions or concerns?'): string {
  return `
    <table bgcolor="#ffffff" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" style="text-align:center;width:100%;max-width:660px;background-color:#ffffff">
      <tr>
        <td align="center" style="padding:40px 0px;text-align:center">
          <table bgcolor="#EFF4F9" width="100%" border="0" cellpadding="0" cellspacing="0" align="center" style="padding:38px 0px;width:100%;max-width:580px;border-radius:4px;text-align:center;margin:0 auto;border:1px solid #c3ced5">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" style="width:100%;max-width:500px;margin:0 auto">
                  <tr>
                    <td style="color:${BRAND_GREEN};text-align:center;line-height:33px;padding:0 0 20px 0;font-size:26px;font-weight:600;font-family:Avenir,Arial,sans-serif">
                      ${heading}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="text-align:center">
                      <table align="center" role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;text-align:center">
                        <tr>
                          <td align="center" height="44" style="font-size:16px;color:${BRAND_GREEN};font-family:Avenir,Arial,sans-serif;border-radius:4px;border:2px solid ${BRAND_GREEN};text-decoration:none;height:44px;text-align:center">
                            <a href="${SUPPORT_TEL}" style="text-align:center;font-family:Avenir,Arial,sans-serif;color:${BRAND_GREEN};text-decoration:none;font-weight:600;font-size:16px;line-height:24px;display:block;margin:0 auto;padding:0 20px">
                              (888) 829-8848
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function emailFooter(toEmail: string): string {
  const year = new Date().getFullYear();
  return `
    <table bgcolor="#21262A" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" style="text-align:center;background-color:#21262a;width:100%;max-width:660px">
      <tr>
        <td style="padding-top:40px">
          <table cellspacing="0" cellpadding="0" width="100%" align="center" style="margin:0 auto;width:100%;max-width:580px">
            <tr>
              <td style="color:#ffffff;text-align:left;font-size:12px;line-height:16px;font-weight:400;font-family:Avenir,Arial,sans-serif;padding-bottom:20px">
                This email was sent to ${escapeHtml(toEmail)} regarding your QuickBooks Enterprise order.
              </td>
            </tr>
            <tr>
              <td style="color:#ffffff;text-align:left;font-size:12px;line-height:16px;font-weight:400;font-family:Avenir,Arial,sans-serif;padding-bottom:20px">
                <a href="${BASE_URL}/terms" style="color:#ffffff;text-decoration:underline" target="_blank">Terms of Service</a>
                <br><br>
                &copy; ${year} QuickBooks Enterprise Services.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export interface PaymentReceiptEmailData {
  customerName: string;
  toEmail: string;
  companyName?: string;
  orderId: string;
  paidAt: Date;
  amountUSD: number;
  paymentMethodLabel: string;
  planDetails?: string;
}

export function renderPaymentReceiptEmailHtml(data: PaymentReceiptEmailData): string {
  const {
    customerName, companyName, orderId, paidAt, amountUSD, paymentMethodLabel, planDetails,
  } = data;

  const name = escapeHtml(customerName || 'there');
  const dateStr = paidAt.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const amountStr = `$${amountUSD.toFixed(2)}`;

  return wrapEmailDocument('Payment success', `
<div style="margin:0;padding:0;font-family:Avenir,Arial,sans-serif;background-color:#f4f5f8">
  <div style="background-color:#f4f5f8;width:100%">

    ${emailHeader()}

    <table bgcolor="#F4F4EF" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" style="background-color:#f4f4ef;text-align:center;width:100%;max-width:660px">
      <tr>
        <td align="center" style="text-align:center">
          <table width="100%" align="center" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;text-align:center;margin:0 auto">
            <tr>
              <td align="center" style="text-align:center;padding-top:40px">
                <img alt="Payment successful" width="72" height="72" style="width:72px;height:72px;display:block;margin:0 auto;border:0" src="${SUCCESS_ICON_URL}">
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:Avenir,Arial,sans-serif;text-align:center;font-size:40px;font-weight:600;line-height:52px;padding-top:10px;color:#000000">
                Payment success
              </td>
            </tr>
            <tr>
              <td style="font-family:Avenir,Arial,sans-serif;font-size:20px;font-weight:400;line-height:28px;color:#000000;text-align:center;padding-top:12px">
                ${name}, thank you for your payment.
              </td>
            </tr>

            <tr>
              <td align="center" style="text-align:center;padding-top:40px;padding-bottom:40px">
                <table align="center" width="100%" style="width:100%;max-width:580px;border-radius:4px;background-color:#ffffff;border:1px solid #c3ced5;margin:0 auto;text-align:center">
                  <tr>
                    <td align="center" style="text-align:center;padding-top:36px;padding-bottom:38px">
                      <table align="center" border="0" cellspacing="0" cellpadding="0" width="100%" style="text-align:center;width:100%;max-width:500px;margin:0 auto">
                        ${detailRow('Invoice number:', orderId, true)}
                        ${detailRow('Invoice date:', dateStr)}
                        ${detailRow('Total:', amountStr)}
                        ${detailRow('Payment method:', escapeHtml(paymentMethodLabel))}
                      </table>

                      <table role="presentation" width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:500px">
                        <tr>
                          <td style="padding-top:24px">
                            <table cellspacing="0" cellpadding="0" border="0" align="center">
                              <tr>
                                <td align="center" style="padding:12px 20px;background-color:${BRAND_NAVY};border-radius:4px">
                                  <a href="${SUPPORT_MAILTO}" style="color:#ffffff;text-decoration:none;font-size:16px;line-height:24px;font-weight:600;font-family:Avenir,Arial,sans-serif" target="_blank">
                                    View invoice
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <table align="center" border="0" cellspacing="0" cellpadding="0" width="100%" style="text-align:center;width:100%;max-width:500px;margin:0 auto">
                        <tr>
                          <td style="padding-top:14px">
                            <table width="100%" align="center" style="text-align:center;width:100%;margin:0 auto">
                              <tr>
                                <td align="center" style="font-family:Avenir,Arial,sans-serif;font-size:16px;line-height:24px;font-weight:400;text-align:center;color:#000000">
                                  Contact our support team if you have questions about this invoice or need a copy for your records.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td align="center" style="padding-bottom:40px;text-align:center">
          <table width="100%" border="0" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:4px;padding:16px">
            <tr>
              <td align="left" valign="top" width="24" style="padding-right:8px">
                <table role="presentation" width="24" height="24" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" valign="middle" width="24" height="24" bgcolor="${BRAND_GREEN}" style="background-color:${BRAND_GREEN};border-radius:50%;width:24px;height:24px;font-size:13px;color:#ffffff;line-height:24px">&#9733;</td>
                  </tr>
                </table>
              </td>
              <td align="left" style="color:#000000;font-size:14px;line-height:18px;font-weight:600;font-family:Avenir,Arial,sans-serif;text-align:left">
                Need more users, storage, or add-ons for your plan?
              </td>
            </tr>
            <tr>
              <td></td>
              <td align="left" style="color:#000000;font-size:14px;line-height:18px;font-weight:400;font-family:Avenir,Arial,sans-serif;padding-top:8px;text-align:left">
                Reach out any time and our team will help you scale your QuickBooks Enterprise plan as your business grows.
                <a href="${SUPPORT_MAILTO}" style="color:${BRAND_GREEN};text-decoration:none;font-size:14px;line-height:18px;font-weight:500;font-family:Avenir,Arial,sans-serif">Contact us</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${orderDetailsSection(companyName || customerName, orderId, planDetails)}
    ${supportBox()}
    ${emailFooter(data.toEmail)}

  </div>
</div>`);
}

export interface PaymentFailedEmailData {
  customerName: string;
  toEmail: string;
  companyName?: string;
  orderId: string;
  amountDueUSD: number;
  paymentMethodLabel: string;
  billingDate: Date;
  cancellationDate: Date;
  planDetails?: string;
  /** Where the "Update payment method" button should send them. Defaults to the support mailto since there's no self-service billing portal. */
  updateUrl?: string;
}

export function renderPaymentFailedEmailHtml(data: PaymentFailedEmailData): string {
  const {
    customerName, companyName, amountDueUSD, paymentMethodLabel,
    billingDate, cancellationDate, planDetails, updateUrl,
  } = data;

  const name = escapeHtml(customerName || 'there');
  const amountStr = `$${amountDueUSD.toFixed(2)}`;
  const billingDateStr = billingDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const cancellationDateStr = cancellationDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ctaUrl = updateUrl || SUPPORT_MAILTO;

  return wrapEmailDocument('Action needed on your payment', `
<div style="margin:0;padding:0;font-family:Avenir,Arial,sans-serif;background-color:#f4f5f8">
  <div style="background-color:#f4f5f8;width:100%">

    ${emailHeader()}

    <table bgcolor="#F4F4EF" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" style="background-color:#f4f4ef;text-align:center;width:100%;max-width:660px">
      <tr>
        <td align="center" style="text-align:center">
          <table width="100%" align="center" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;text-align:center;margin:0 auto">
            <tr>
              <td align="center" style="text-align:center;padding-top:40px">
                <img alt="Action needed" width="72" height="72" style="width:72px;height:72px;display:block;margin:0 auto;border:0" src="${ALERT_ICON_URL}">
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:Avenir,Arial,sans-serif;text-align:center;font-size:40px;font-weight:600;line-height:52px;padding-top:10px;color:#000000">
                Take action now
              </td>
            </tr>
            <tr>
              <td style="font-family:Avenir,Arial,sans-serif;font-size:20px;font-weight:400;line-height:28px;color:#000000;text-align:center;padding-top:12px">
                ${name}, please update your payment details today.
              </td>
            </tr>

            <tr>
              <td align="center" style="text-align:center;padding:40px 0px">
                <table align="center" width="100%" style="width:100%;max-width:580px;border-radius:4px;background-color:#ffffff;border:1px solid #c3ced5;margin:0 auto;text-align:center">
                  <tr>
                    <td align="center" style="text-align:center;padding-top:36px;padding-bottom:38px">
                      <table align="center" border="0" cellspacing="0" cellpadding="0" width="100%" style="text-align:center;width:100%;max-width:500px;margin:0 auto">
                        ${detailRow('Company name:', escapeHtml(companyName || customerName), true, 240)}
                        ${detailRow('Payment method:', escapeHtml(paymentMethodLabel), false, 240)}
                        ${detailRow('Amount due:', amountStr, false, 240)}
                        ${detailRow('Billing date:', billingDateStr, false, 240)}
                        ${detailRow('Cancellation date:', cancellationDateStr, false, 240)}
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto">
                  <tr>
                    <td style="padding-top:16px">
                      <table cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" style="padding:12px 20px;background-color:${BRAND_NAVY};border-radius:4px">
                            <a href="${ctaUrl}" style="color:#ffffff;text-decoration:none;font-size:16px;line-height:24px;font-weight:600;font-family:Avenir,Arial,sans-serif" target="_blank">
                              Update now
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:660px;background-color:#ffffff;border-collapse:collapse" bgcolor="#ffffff">
      <tr>
        <td align="center" style="padding-top:40px">
          <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px">
            <tr>
              <td align="left" style="text-align:left;color:#000000;font-size:16px;line-height:24px;font-weight:400;font-family:Avenir,Arial,sans-serif">
                We&rsquo;ll try one more time to renew your subscription, so please update your payment info as soon as you can.
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:660px" bgcolor="#ffffff">
            <tr>
              <td align="center" style="padding-top:40px">
                <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px">
                  <tr>
                    <td align="left" style="font-family:Avenir,Arial,sans-serif;font-size:28px;line-height:36px;color:#000000;font-weight:600;padding-bottom:20px">
                      Account details
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px">
                  <tr>
                    <td width="50%" valign="top" align="left" style="width:50%;color:#000000;font-size:16px;line-height:26px;font-weight:600;font-family:Avenir,Arial,sans-serif">
                      Affected subscriptions:
                    </td>
                    <td width="50%" valign="top" align="left" style="width:50%;color:#000000;font-size:16px;line-height:26px;font-weight:400;font-family:Avenir,Arial,sans-serif">
                      ${escapeHtml(planDetails || 'QuickBooks Enterprise')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${supportBox('We&#39;re here to help')}
    ${emailFooter(data.toEmail)}

  </div>
</div>`);
}
