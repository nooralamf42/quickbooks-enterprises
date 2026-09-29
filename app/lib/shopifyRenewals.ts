/**
 * Renewal billing for Shopify subscription contracts.
 *
 * WHY THIS EXISTS: every subscription this app sells is a Shopify SubscriptionContract
 * owned by THIS app (created at checkout from our own selling plan). Shopify only runs
 * renewals automatically for contracts owned by its own first-party Subscriptions app —
 * for a contract owned by any other app, the owning app has to start each renewal charge
 * itself by creating a billing attempt. Nothing in this codebase did that, so contracts sat
 * ACTIVE, past their nextBillingDate, forever (verified against the live store: 8 contracts,
 * zero billing attempts ever, two already overdue). The webhook handlers that log a successful
 * renewal (api/shopify/subscription-webhook) were waiting on a charge nothing ever started.
 *
 * SAFETY MODEL — this moves real money, so every default errs toward not charging:
 *  - Nothing is charged unless `live` is true. The route only sets it when
 *    SHOPIFY_RENEWAL_BILLING_ENABLED=true, or for one explicitly named contract.
 *  - A deterministic idempotency key per contract + billing cycle + retry number means a
 *    double-fired cron (or a retry of the same request) cannot charge a customer twice.
 *  - A contract overdue by more than `maxOverdueDays` is reported, not charged, unless it is
 *    named explicitly — a long-overdue contract is a decision for a human (has the customer
 *    already re-subscribed? cancelled by phone?), not something to sweep up silently.
 *  - Failed attempts are retried at most `maxAttempts` times, `retryAfterDays` apart.
 *  - At most `maxChargesPerRun` charges per run.
 */

export type GraphQLRunner = (
  query: string,
  variables?: Record<string, any>,
) => Promise<{ ok: boolean; data?: any; errors?: any[] }>;

export interface RenewalOptions {
  /** When false (the default) nothing is charged; the report shows what WOULD be. */
  live?: boolean;
  now?: Date;
  /** Contracts (numeric id or full gid) that may be charged even if overdue past the guard. */
  onlyContracts?: string[];
  maxOverdueDays?: number;
  maxAttempts?: number;
  retryAfterDays?: number;
  maxChargesPerRun?: number;
}

export type RenewalAction =
  | 'charged'
  | 'would_charge'
  | 'already_billed_date_advanced'
  | 'already_billed_would_advance_date'
  | 'not_due'
  | 'skipped_overdue_needs_review'
  | 'skipped_waiting_retry'
  | 'skipped_attempt_in_flight'
  | 'skipped_retries_exhausted'
  | 'skipped_not_selected'
  | 'skipped_run_limit'
  | 'error';

export interface RenewalReportRow {
  contractId: string;
  amount: string;
  nextBillingDate: string | null;
  action: RenewalAction;
  detail?: string;
}

export interface RenewalReport {
  live: boolean;
  ranAt: string;
  contractsChecked: number;
  charged: number;
  wouldCharge: number;
  rows: RenewalReportRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_QUERY = `
  query ($cursor: String) {
    subscriptionContracts(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        status
        nextBillingDate
        billingPolicy { interval intervalCount }
        lines(first: 1) { nodes { currentPrice { amount currencyCode } } }
        billingAttempts(first: 20) {
          nodes { id ready errorCode errorMessage originTime createdAt order { id } }
        }
      }
    }
  }
`;

const CREATE_ATTEMPT = `
  mutation ($id: ID!, $input: SubscriptionBillingAttemptInput!) {
    subscriptionBillingAttemptCreate(subscriptionContractId: $id, subscriptionBillingAttemptInput: $input) {
      subscriptionBillingAttempt { id ready errorCode errorMessage }
      userErrors { field message code }
    }
  }
`;

const SET_NEXT_BILLING_DATE = `
  mutation ($id: ID!, $date: DateTime!) {
    subscriptionContractSetNextBillingDate(contractId: $id, date: $date) {
      contract { id nextBillingDate }
      userErrors { field message }
    }
  }
`;

const numericId = (gid: string) => gid.split('/').pop() || gid;

/** `date` plus one billing interval, in UTC, keeping the time of day. Month/year steps clamp
 *  to the last day of a shorter month (Jan 31 + 1 month = Feb 28), so a contract that started
 *  on the 31st never drifts or overflows into the next month. */
export function addBillingInterval(date: Date, interval: string, count: number): Date {
  const d = new Date(date.getTime());
  if (interval === 'DAY') { d.setUTCDate(d.getUTCDate() + count); return d; }
  if (interval === 'WEEK') { d.setUTCDate(d.getUTCDate() + 7 * count); return d; }
  const months = interval === 'YEAR' ? 12 * count : count;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Moves a contract's nextBillingDate forward one interval after its cycle was billed.
 *
 * Shopify does NOT do this for contracts owned by an app — the owning app has to (verified
 * live: after a successful billing attempt the contract still showed the old due date, which
 * would have made every later run see it as due again). Only acts when the contract's current
 * date is still the cycle that was just billed, so calling it twice (job + webhook) is a no-op
 * the second time rather than skipping a month.
 */
export async function advanceNextBillingDate(
  gql: GraphQLRunner,
  contractGid: string,
  billedCycle: Date,
  currentNextBillingDate: string | null,
  interval: string,
  count: number,
): Promise<{ advanced: boolean; newDate?: string; reason?: string }> {
  if (!currentNextBillingDate || new Date(currentNextBillingDate).getTime() !== billedCycle.getTime()) {
    return { advanced: false, reason: 'next billing date already moved past this cycle' };
  }
  const next = addBillingInterval(billedCycle, interval, count);
  const res = await gql(SET_NEXT_BILLING_DATE, { id: contractGid, date: next.toISOString() });
  const err = res.data?.subscriptionContractSetNextBillingDate?.userErrors?.[0];
  if (!res.ok || err) return { advanced: false, reason: err ? err.message : JSON.stringify(res.errors) };
  return { advanced: true, newDate: next.toISOString() };
}

export async function runRenewalBilling(gql: GraphQLRunner, opts: RenewalOptions = {}): Promise<RenewalReport> {
  const live = opts.live === true;
  const now = opts.now ?? new Date();
  const maxOverdueDays = opts.maxOverdueDays ?? 3;
  const maxAttempts = opts.maxAttempts ?? 3;
  const retryAfterDays = opts.retryAfterDays ?? 3;
  const maxChargesPerRun = opts.maxChargesPerRun ?? 10;
  const selected = new Set((opts.onlyContracts ?? []).map((c) => numericId(c)));

  // --- Load every active contract (paged). ---
  const contracts: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page++) {
    const res = await gql(LIST_QUERY, { cursor });
    if (!res.ok || !res.data?.subscriptionContracts) {
      throw new Error(`Could not list subscription contracts: ${JSON.stringify(res.errors)}`);
    }
    const conn = res.data.subscriptionContracts;
    contracts.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  const rows: RenewalReportRow[] = [];
  let charged = 0;
  let wouldCharge = 0;

  for (const c of contracts) {
    if (c.status !== 'ACTIVE') continue;
    const amount = c.lines?.nodes?.[0]?.currentPrice?.amount ?? '?';
    const base = { contractId: c.id as string, amount: String(amount), nextBillingDate: (c.nextBillingDate as string) ?? null };

    if (!c.nextBillingDate) { rows.push({ ...base, action: 'not_due', detail: 'no next billing date' }); continue; }
    const due = new Date(c.nextBillingDate);
    if (due.getTime() > now.getTime()) { rows.push({ ...base, action: 'not_due' }); continue; }

    const isSelected = selected.has(numericId(c.id));
    if (selected.size > 0 && !isSelected) { rows.push({ ...base, action: 'skipped_not_selected' }); continue; }

    // Attempts already made for THIS billing cycle (matched by originTime == the due date).
    const attempts: any[] = (c.billingAttempts?.nodes ?? []).filter(
      (a: any) => a.originTime && new Date(a.originTime).getTime() === due.getTime(),
    );
    // This cycle was already billed successfully but the due date never moved (Shopify leaves
    // that to the owning app). Never charge it again — just move the date forward. Checked
    // BEFORE the overdue guard: moving a date is not a charge, so how overdue it looks is
    // irrelevant, and the guard would otherwise leave exactly these contracts stuck.
    const succeeded = attempts.find((a) => a.ready && !a.errorCode && a.order?.id);
    if (succeeded) {
      const policy = c.billingPolicy ?? { interval: 'MONTH', intervalCount: 1 };
      if (!live) { rows.push({ ...base, action: 'already_billed_would_advance_date', detail: `billed by ${succeeded.id}` }); continue; }
      const adv = await advanceNextBillingDate(gql, c.id, due, c.nextBillingDate, policy.interval, policy.intervalCount);
      rows.push({ ...base, action: adv.advanced ? 'already_billed_date_advanced' : 'error', detail: adv.advanced ? `next due ${adv.newDate}` : adv.reason });
      continue;
    }

    const overdueDays = (now.getTime() - due.getTime()) / DAY_MS;
    if (overdueDays > maxOverdueDays && !isSelected) {
      rows.push({ ...base, action: 'skipped_overdue_needs_review', detail: `${Math.floor(overdueDays)} days overdue — name it explicitly to charge` });
      continue;
    }

    const inFlight = attempts.find((a) => !a.ready && !a.errorCode && now.getTime() - new Date(a.createdAt).getTime() < 60 * 60 * 1000);
    if (inFlight) { rows.push({ ...base, action: 'skipped_attempt_in_flight', detail: inFlight.id }); continue; }

    const failures = attempts.filter((a) => a.errorCode);
    if (failures.length >= maxAttempts) {
      rows.push({ ...base, action: 'skipped_retries_exhausted', detail: `${failures.length} failed attempts, last: ${failures[failures.length - 1].errorCode}` });
      continue;
    }
    const lastFail = failures.length ? Math.max(...failures.map((a) => new Date(a.createdAt).getTime())) : 0;
    if (lastFail && now.getTime() - lastFail < retryAfterDays * DAY_MS) {
      rows.push({ ...base, action: 'skipped_waiting_retry', detail: `last failure ${failures[failures.length - 1].errorCode}` });
      continue;
    }

    if (charged + wouldCharge >= maxChargesPerRun) { rows.push({ ...base, action: 'skipped_run_limit' }); continue; }

    if (!live) { wouldCharge++; rows.push({ ...base, action: 'would_charge', detail: `attempt #${failures.length + 1}` }); continue; }

    // Same key => Shopify returns the SAME attempt instead of charging again.
    const idempotencyKey = `qbe-renewal-${numericId(c.id)}-${due.toISOString()}-${failures.length}`;
    // ALLOW_OVERSELLING: these are digital licences — several tiers show 0 or negative stock
    // on the product, and a renewal must never fail on an inventory check for something that
    // has no physical stock.
    const res = await gql(CREATE_ATTEMPT, {
      id: c.id,
      input: { idempotencyKey, originTime: due.toISOString(), inventoryPolicy: 'ALLOW_OVERSELLING' },
    });
    const payload = res.data?.subscriptionBillingAttemptCreate;
    const userErr = payload?.userErrors?.[0];
    if (!res.ok || userErr || !payload?.subscriptionBillingAttempt) {
      rows.push({ ...base, action: 'error', detail: userErr ? `${userErr.code ?? ''} ${userErr.message}` : JSON.stringify(res.errors) });
      continue;
    }
    charged++;
    rows.push({ ...base, action: 'charged', detail: `attempt ${payload.subscriptionBillingAttempt.id} (result arrives via webhook)` });
  }

  return { live, ranAt: now.toISOString(), contractsChecked: contracts.length, charged, wouldCharge, rows };
}
