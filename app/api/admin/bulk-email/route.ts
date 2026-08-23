import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { renderPaymentFailedEmailHtml, renderPaymentReceiptEmailHtml } from '@/app/lib/emailTemplates';
import { logEmailSent } from '@/app/lib/emailLog';

export const maxDuration = 300;

/** Rows are sent one at a time with a gap. Resend's limit is 10 req/sec per team, so
 *  ~8/sec leaves headroom for any other route sending concurrently. */
const SEND_GAP_MS = 120;

/** Sends are sequential, so the batch has to finish inside maxDuration above. Budgeting
 *  ~0.6s per row (send latency + SEND_GAP_MS) puts 250 rows near 150s — half the ceiling.
 *  A larger batch would be cut off mid-send with no result returned to the caller. */
const MAX_ROWS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkRow {
  rowNumber: number;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  amountDueUSD?: string | number;
  billingDate?: string;
  product?: string;
  paymentMethod?: string;
  licenseNumber?: string;
  can?: string;
  /** Checkout link for the "Update now" button, built client-side so it carries the
   *  browser's origin. Falls back to the support mailto in the template when absent. */
  updateUrl?: string;
}

interface RowResult {
  rowNumber: number;
  email: string;
  /** `accepted` means Resend took the message — NOT that it was delivered. Bounces and
   *  suppressions surface later through the delivery webhook. */
  status: 'accepted' | 'skipped' | 'failed';
  reason?: string;
  resendId?: string;
}

/** Parses YYYY-MM-DD (and a few common variants) into a UTC-noon Date so timezone
 *  shifts can't roll the displayed date back to the previous day. */
function parseDate(input: unknown): Date | null {
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  const s = String(input ?? '').trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12));

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY
  if (slash) return new Date(Date.UTC(+slash[3], +slash[1] - 1, +slash[2], 12));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function validate(row: BulkRow): string | null {
  if (!row.email || !EMAIL_RE.test(String(row.email).trim())) return 'Missing or invalid email';
  const amt = Number(row.amountDueUSD);
  if (row.amountDueUSD === undefined || row.amountDueUSD === '' || isNaN(amt)) return 'Missing or invalid amount';
  if (amt < 0) return 'Amount cannot be negative';
  if (!parseDate(row.billingDate)) return 'Missing or invalid billing date';
  if (!row.product || !String(row.product).trim()) return 'Missing product';
  return null;
}

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

    const { rows, type = 'failed', dryRun = false } = (await req.json()) as {
      rows: BulkRow[]; type?: 'failed' | 'success'; dryRun?: boolean;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows supplied' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({
        error: `Too many rows in one batch (max ${MAX_ROWS}). Split the file and send it in parts.`,
      }, { status: 400 });
    }

    // Validate everything up front so a dry run can surface all problems at once.
    const results: RowResult[] = [];
    const sendable: { row: BulkRow; amount: number; billing: Date; cancellation: Date }[] = [];

    for (const row of rows) {
      const problem = validate(row);
      if (problem) {
        results.push({ rowNumber: row.rowNumber, email: String(row.email ?? ''), status: 'skipped', reason: problem });
        continue;
      }
      const billing = parseDate(row.billingDate)!;
      // Cancellation is always the day after the billing date.
      const cancellation = new Date(billing.getTime() + 24 * 60 * 60 * 1000);
      sendable.push({ row, amount: Number(row.amountDueUSD), billing, cancellation });
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: rows.length,
        wouldSend: sendable.length,
        skipped: results.length,
        results: [
          ...sendable.map((s) => ({ rowNumber: s.row.rowNumber, email: String(s.row.email), status: 'accepted' as const })),
          ...results,
        ].sort((a, b) => a.rowNumber - b.rowNumber),
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = type === 'success'
      ? 'We received your QuickBooks Enterprise payment!'
      : 'Action needed: update your QuickBooks Enterprise payment method';

    for (const { row, amount, billing, cancellation } of sendable) {
      const toEmail = String(row.email).trim();
      const customerName = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'there';
      const orderId = String(row.can ?? '').trim() || `BULK-${Date.now().toString(36).toUpperCase()}-${row.rowNumber}`;

      try {
        const html = type === 'success'
          ? renderPaymentReceiptEmailHtml({
              customerName, toEmail, companyName: row.companyName, orderId,
              paidAt: billing, amountUSD: amount,
              paymentMethodLabel: row.paymentMethod || 'Card on file',
              planDetails: row.product,
              licenseNumber: row.licenseNumber || undefined,
            })
          : renderPaymentFailedEmailHtml({
              customerName, toEmail, companyName: row.companyName, orderId,
              amountDueUSD: amount,
              paymentMethodLabel: row.paymentMethod || 'the payment method on file',
              billingDate: billing,
              cancellationDate: cancellation,
              planDetails: row.product,
              updateUrl: row.updateUrl,
              // Bulk sends are monthly subscriptions — this drives the "Plan:" row,
              // leaving planDetails to describe the subscription itself.
              billingCycle: 'Monthly',
              // numUsers / contractYears deliberately omitted so those rows stay hidden.
            });

        const { data, error } = await resend.emails.send({
          from: 'QuickBooks Enterprise <notifications@quickbooks-enterprises.com>',
          to: toEmail,
          subject,
          html,
        });

        const logBase = {
          type: (type === 'success' ? 'receipt' : 'reminder') as 'receipt' | 'reminder',
          toEmail, customerName, orderId,
          planDetails: row.product,
          amountUSD: amount,
          subject,
          trigger: 'admin-bulk' as const,
        };

        if (error) {
          const reason = error.message || 'Resend rejected the send';
          results.push({ rowNumber: row.rowNumber, email: toEmail, status: 'failed', reason });
          // Log rejections too — an email that never left is exactly what an admin needs to see.
          await logEmailSent({ ...logBase, deliveryStatus: 'rejected', deliveryDetail: reason });
        } else {
          // "accepted", not "sent": Resend has taken the message but bounces arrive later,
          // via the webhook at /api/resend/webhook.
          results.push({ rowNumber: row.rowNumber, email: toEmail, status: 'accepted', resendId: data?.id });
          await logEmailSent({ ...logBase, resendId: data?.id, deliveryStatus: 'accepted' });
        }
      } catch (err: any) {
        results.push({ rowNumber: row.rowNumber, email: toEmail, status: 'failed', reason: err?.message || 'Unknown error' });
      }

      await sleep(SEND_GAP_MS);
    }

    results.sort((a, b) => a.rowNumber - b.rowNumber);
    return NextResponse.json({
      total: rows.length,
      sent: results.filter((r) => r.status === 'accepted').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
    });
  } catch (err: any) {
    console.error('[Bulk Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
