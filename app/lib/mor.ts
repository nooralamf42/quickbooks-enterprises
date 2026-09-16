import crypto from 'crypto';

const API_BASE = 'https://api.trymor.ai';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[MOR.AI] Missing required env var: ${name}`);
  return value;
}

export interface MorCustomer {
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface CreateMorPaymentParams {
  amountUSD: number;
  reference: string;
  returnUrl: string;
  callbackUrl?: string;
  description?: string;
  metadata?: Record<string, string>;
  customer?: MorCustomer;
  idempotencyKey: string;
}

export interface MorPaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  reference: string;
  checkout_url: string;
  expires_at: string;
  created_at: string;
}

interface MorApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function callMorApi<T = any>(path: string, body: Record<string, any>, idempotencyKey?: string): Promise<MorApiResult<T>> {
  const apiKey = requireEnv('MOR_API_KEY');

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function createMorPayment(params: CreateMorPaymentParams): Promise<MorApiResult<MorPaymentResponse>> {
  const body: Record<string, any> = {
    // MOR.AI amounts are an integer in the currency's smallest unit (cents for USD).
    amount: Math.round(params.amountUSD * 100),
    currency: 'USD',
    reference: params.reference,
    return_url: params.returnUrl,
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(params.customer ? { customer: params.customer } : {}),
  };

  return callMorApi<MorPaymentResponse>('/v1/payments', body, params.idempotencyKey);
}

export async function getMorPayment(paymentId: string) {
  const apiKey = requireEnv('MOR_API_KEY');
  const res = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

/**
 * Verifies an inbound MOR.AI callback signature: HMAC-SHA256 over `${timestamp}.${rawBody}`,
 * keyed with the webhook secret. Must run against the raw, unparsed request body.
 */
export function verifyMorSignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err) {
    console.error('[MOR.AI] Signature verification error:', err);
    return false;
  }
}
