import crypto from 'crypto';

/**
 * PayDollar PayGate hosted checkout (AsiaPay, "Client Post Through Browser" method —
 * https://gtw.online-epayment.com-style integration guide v3.67).
 *
 * Unlike our other gateways, PayDollar's hosted page is reached by the customer's own
 * browser auto-submitting an HTML form via POST (not a GET redirect) — see
 * buildPaydollarCheckoutForm(). Confirmation comes from PayDollar's "Data Feed" (a webhook
 * URL registered once in their merchant admin panel, not passed per-request) plus the
 * Query API as a sync-on-return fallback, mirroring the dual-path pattern used for Antom.
 */

const IS_PRODUCTION = process.env.NEXT_PUBLIC_PAYDOLLAR_IS_PRODUCTION === 'true';

const CHECKOUT_URL = IS_PRODUCTION
  ? 'https://www.paydollar.com/b2c2/eng/payment/payForm.jsp'
  : 'https://test.paydollar.com/b2cDemo/eng/payment/payForm.jsp';

const API_URL = IS_PRODUCTION
  ? 'https://www.paydollar.com/b2c2/eng/merchant/api/orderApi.jsp'
  : 'https://test.paydollar.com/b2cDemo/eng/merchant/api/orderApi.jsp';

// PayDollar currency codes are numeric strings, not ISO letters.
const CURR_CODE_USD = '840';

export interface PaydollarConfig {
  merchantId: string;
  /** Only set once Secure Hash is enabled on the merchant account; requests go unsigned otherwise. */
  secureHashSecret?: string;
}

export function getPaydollarConfig(): PaydollarConfig | null {
  const merchantId = process.env.PAYDOLLAR_MERCHANT_ID?.trim();
  if (!merchantId) return null;
  return { merchantId, secureHashSecret: process.env.PAYDOLLAR_SECURE_HASH_SECRET?.trim() || undefined };
}

/** Signing data string = merchantId|orderRef|currCode|amount|payType|secret (guide section 4). SHA-1 is PayDollar's default. */
export function generateSecureHash(
  params: { merchantId: string; orderRef: string; currCode: string; amount: string; payType: string },
  secret: string,
): string {
  const signingString = [params.merchantId, params.orderRef, params.currCode, params.amount, params.payType, secret].join('|');
  return crypto.createHash('sha1').update(signingString, 'utf8').digest('hex');
}

/** Verifies a Data Feed secure hash: src|prc|successcode|ref|payRef|cur|amt|payerAuth|secret, SHA-1 or SHA-256. */
export function verifyDatafeedSecureHash(
  params: { src: string; prc: string; successcode: string; ref: string; payRef: string; cur: string; amt: string; payerAuth: string },
  secret: string,
  receivedHash: string,
): boolean {
  const signingString = [params.src, params.prc, params.successcode, params.ref, params.payRef, params.cur, params.amt, params.payerAuth, secret].join('|');
  const sha1 = crypto.createHash('sha1').update(signingString, 'utf8').digest('hex');
  const sha256 = crypto.createHash('sha256').update(signingString, 'utf8').digest('hex');
  const received = receivedHash.trim().toLowerCase();
  try {
    for (const candidate of [sha1, sha256]) {
      const candidateBuf = Buffer.from(candidate);
      const receivedBuf = Buffer.from(received);
      if (candidateBuf.length === receivedBuf.length && crypto.timingSafeEqual(candidateBuf, receivedBuf)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface PaydollarCheckoutParams {
  orderRef: string;
  amountUSD: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  remark?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  billingAddress1?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
}

export interface PaydollarCheckoutForm {
  formAction: string;
  fields: Record<string, string>;
}

/** Builds the hidden-field set the customer's browser must POST to PayDollar's hosted payment page. */
export function buildPaydollarCheckoutForm(cfg: PaydollarConfig, params: PaydollarCheckoutParams): PaydollarCheckoutForm {
  const amount = params.amountUSD.toFixed(2);
  const currCode = CURR_CODE_USD;
  const payType = 'N'; // Normal Payment (Sales); "H" (Hold/Authorize-only) is not used here.

  const fields: Record<string, string> = {
    merchantId: cfg.merchantId,
    orderRef: params.orderRef,
    currCode,
    amount,
    lang: 'E',
    payMethod: 'CC',
    payType,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
    cancelUrl: params.cancelUrl,
  };

  if (params.remark) fields.remark = params.remark.slice(0, 50);
  if (params.customerFirstName) fields.billingFirstName = params.customerFirstName.slice(0, 60);
  if (params.customerLastName) fields.billingLastName = params.customerLastName.slice(0, 60);
  if (params.customerEmail) fields.billingEmail = params.customerEmail.slice(0, 255);
  if (params.billingAddress1) fields.billingStreet1 = params.billingAddress1.slice(0, 40);
  if (params.billingCity) fields.billingCity = params.billingCity.slice(0, 50);
  if (params.billingState) fields.billingState = params.billingState.slice(0, 2);
  if (params.billingPostalCode) fields.billingPostalCode = params.billingPostalCode.slice(0, 10);
  if (params.billingCountry) fields.billingCountry = params.billingCountry.slice(0, 2);

  if (cfg.secureHashSecret) {
    fields.secureHash = generateSecureHash({ merchantId: cfg.merchantId, orderRef: params.orderRef, currCode, amount, payType }, cfg.secureHashSecret);
  }

  return { formAction: CHECKOUT_URL, fields };
}

export interface PaydollarQueryResult {
  orderStatus?: string;
  ref?: string;
  payRef?: string;
  amt?: string;
  cur?: string;
  successcode?: string;
  errMsg?: string;
}

/**
 * Merchant API "Query" action — looks a transaction up by our order reference, as a sync-on-return
 * fallback. Returns null (treated as "still pending") rather than throwing when the Merchant API
 * credentials aren't configured yet, so the Data Feed webhook remains the source of truth until then.
 */
export async function queryPaydollarOrder(orderRef: string): Promise<PaydollarQueryResult | null> {
  const merchantId = process.env.PAYDOLLAR_MERCHANT_ID?.trim();
  const loginId = process.env.PAYDOLLAR_API_LOGIN_ID?.trim();
  const password = process.env.PAYDOLLAR_API_PASSWORD?.trim();
  if (!merchantId || !loginId || !password) {
    console.warn('[PayDollar] Query API not configured (missing merchantId/loginId/password) — skipping sync fallback');
    return null;
  }

  const body = new URLSearchParams({ merchantId, loginId, password, actionType: 'Query', orderRef });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    // The response body is itself an html-request-format string: "orderStatus=Accepted&ref=...&payRef=...".
    const text = await res.text();
    const parsed = new URLSearchParams(text);
    const result: PaydollarQueryResult = {};
    for (const [key, value] of parsed.entries()) (result as Record<string, string>)[key] = value;
    return result;
  } catch (err) {
    console.error('[PayDollar] Query API failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
