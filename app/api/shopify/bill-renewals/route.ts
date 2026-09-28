import { NextRequest, NextResponse } from 'next/server';
import { adminGraphQL } from '@/app/lib/shopify';
import { runRenewalBilling } from '@/app/lib/shopifyRenewals';

export const maxDuration = 60;

/**
 * Starts renewal charges for subscription contracts that are due. See app/lib/shopifyRenewals.ts
 * for why this has to exist and for the safety rules.
 *
 * Callers:
 *  - Vercel Cron (vercel.json) — sends `Authorization: Bearer $CRON_SECRET`. Charges ONLY when
 *    SHOPIFY_RENEWAL_BILLING_ENABLED=true; otherwise it is a dry run that just reports.
 *  - An admin (Bearer <admin password hash>, same as every other admin endpoint):
 *      GET  ?dryRun=1                       — report only, always safe
 *      GET  ?contract=<id>&confirm=CHARGE   — charge exactly that one contract now, even if the
 *                                             global switch is off (the way to run a first test)
 */
async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const adminPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const isAdmin = !!adminPass && auth === `Bearer ${adminPass}`;
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const contract = (params.get('contract') || '').trim();
  const confirmed = params.get('confirm') === 'CHARGE';
  const dryRunParam = params.get('dryRun') === '1';
  const globalSwitch = process.env.SHOPIFY_RENEWAL_BILLING_ENABLED === 'true';

  // Charging one named contract needs an admin AND an explicit confirm — never the cron.
  const singleContractLive = isAdmin && !!contract && confirmed;
  const live = !dryRunParam && (singleContractLive || (globalSwitch && !contract));

  try {
    const report = await runRenewalBilling(adminGraphQL, {
      live,
      onlyContracts: contract ? [contract] : [],
    });
    console.log('[Shopify Renewals]', JSON.stringify({ live: report.live, checked: report.contractsChecked, charged: report.charged, wouldCharge: report.wouldCharge }));
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('[Shopify Renewals] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
