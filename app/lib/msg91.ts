/** MSG91 sender — uses approved transactional templates (Email > Templates in the MSG91
 *  panel), not raw HTML like every other provider wired in here. Each template's Handlebars
 *  variables are documented in msg91-templates/README.md; the mapper functions below build
 *  the exact variable set each template expects from the same structured data the HTML
 *  renderers in emailTemplates.ts already take, so callers don't duplicate field mapping. */

import type {
  PaymentReceiptEmailData,
  PaymentFailedEmailData,
  RefundEmailData,
  FeedbackEmailData,
  QueryEmailData,
} from '@/app/lib/emailTemplates';

const MSG91_SEND_API = 'https://control.msg91.com/api/v5/email/send';

export interface Msg91TemplatePayload {
  templateId: string;
  variables: Record<string, string | undefined>;
}

export interface Msg91SendParams {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName?: string;
  template: Msg91TemplatePayload;
}

export interface Msg91SendResult {
  data?: { id: string };
  error?: { message: string };
}

const dateStr = (d: Date) => d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const b64 = (v?: string) => (v ? Buffer.from(v).toString('base64') : undefined);

export function msg91ReceiptPayload(data: PaymentReceiptEmailData): Msg91TemplatePayload {
  return {
    templateId: 'qbe_receipt',
    variables: {
      customer_name: data.customerName || 'there',
      to_email: data.toEmail,
      company_name: data.companyName,
      order_id: data.orderId,
      invoice_date: dateStr(data.paidAt),
      amount: data.amountUSD.toFixed(2),
      payment_method: data.paymentMethodLabel,
      plan: data.planDetails,
      due_date: data.dueDate ? dateStr(data.dueDate) : undefined,
      num_users: data.numUsers ? String(data.numUsers) : undefined,
      contract_term: data.contractYears ? `${data.contractYears} Year${data.contractYears === 1 ? '' : 's'}` : undefined,
      license_number: data.licenseNumber,
      product_number: data.productNumber,
    },
  };
}

export function msg91ReminderPayload(data: PaymentFailedEmailData): Msg91TemplatePayload {
  return {
    templateId: 'qbe_reminder_2',
    variables: {
      customer_name: data.customerName || 'there',
      to_email: data.toEmail,
      company_name: data.companyName,
      amount_due: data.amountDueUSD.toFixed(2),
      payment_method: data.paymentMethodLabel,
      due_date: dateStr(data.dueDate),
      cancellation_date: dateStr(data.cancellationDate),
      cta_url: data.updateUrl || 'mailto:billing@quickbooks-enterprises.com',
      plan_label: data.billingCycle,
      plan: data.planDetails,
      num_users: data.numUsers ? String(data.numUsers) : undefined,
      contract_term: data.contractYears ? `${data.contractYears} Year${data.contractYears === 1 ? '' : 's'}` : undefined,
    },
  };
}

export function msg91RefundPayload(data: RefundEmailData): Msg91TemplatePayload {
  return {
    templateId: 'qbe_refund',
    variables: {
      customer_name: data.customerName || 'there',
      to_email: data.toEmail,
      company_name: data.companyName,
      refund_number: data.orderId,
      refund_date: dateStr(data.refundedAt),
      refund_amount: data.refundAmountUSD.toFixed(2),
      payment_method: data.paymentMethodLabel,
      plan: data.planDetails,
      reason: data.reason,
    },
  };
}

export function msg91SurveyPayload(data: FeedbackEmailData): Msg91TemplatePayload {
  const name = (data.customerName || '').trim();
  return {
    templateId: 'qbe_survey',
    variables: {
      to_email: data.toEmail,
      customer_name: name || undefined,
      company_name: data.companyName,
      survey_u: b64(data.toEmail),
      survey_n: name ? b64(name) : undefined,
      survey_co: data.companyName ? b64(data.companyName) : undefined,
    },
  };
}

export function msg91QueryPayload(data: QueryEmailData): Msg91TemplatePayload {
  const name = (data.customerName || '').trim();
  const paragraphs = data.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    templateId: 'qbe_query',
    variables: {
      subject: data.subject,
      to_email: data.toEmail,
      customer_name: name || undefined,
      // MSG91 variables are a flat map, so the paragraph array is JSON-stringified here and
      // parsed back out in sendViaMsg91 right before the request body is built — keeps this
      // function's return type consistent with every other mapper's Record<string, string>.
      paragraphs: JSON.stringify(paragraphs) as any,
    },
  };
}

export async function sendViaMsg91(params: Msg91SendParams): Promise<Msg91SendResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const domain = process.env.MSG91_EMAIL_DOMAIN;
  if (!authKey || !domain) {
    return { error: { message: 'MSG91_AUTH_KEY or MSG91_EMAIL_DOMAIN not configured' } };
  }

  const { templateId, variables } = params.template;
  const resolvedVariables: Record<string, unknown> = { ...variables };
  if (typeof resolvedVariables.paragraphs === 'string') {
    try {
      resolvedVariables.paragraphs = JSON.parse(resolvedVariables.paragraphs as string);
    } catch {
      // leave as-is — malformed JSON would only happen from a bug in msg91QueryPayload itself
    }
  }
  // MSG91 drops a variable's row/section (via {{#if}}) when the key is absent, not just
  // empty — strip undefined keys rather than sending them as the literal string "undefined".
  for (const key of Object.keys(resolvedVariables)) {
    if (resolvedVariables[key] === undefined) delete resolvedVariables[key];
  }

  try {
    const res = await fetch(MSG91_SEND_API, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authkey: authKey,
        'content-type': 'application/JSON',
      },
      body: JSON.stringify({
        recipients: [
          {
            to: [{ name: params.toName || params.toEmail, email: params.toEmail }],
            variables: resolvedVariables,
          },
        ],
        from: { name: params.fromName, email: params.fromEmail },
        domain,
        template_id: templateId,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.hasError) {
      const message = json?.errors ? JSON.stringify(json.errors) : json?.message || `MSG91 error ${res.status}`;
      return { error: { message } };
    }

    const id = json?.data?.unique_id || '';
    if (!id) return { error: { message: 'MSG91 response had no unique_id' } };

    return { data: { id } };
  } catch (err: any) {
    return { error: { message: err?.message || 'MSG91 request failed' } };
  }
}
