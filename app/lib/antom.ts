import crypto from 'crypto';

const IS_PRODUCTION = process.env.NEXT_PUBLIC_ANTOM_IS_PRODUCTION === 'true';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[Antom] Missing required env var: ${name}`);
  return value;
}

function toPem(base64Key: string, label: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const cleaned = base64Key.replace(/\s+/g, '');
  const lines = cleaned.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function getApiBasePath(): string {
  return IS_PRODUCTION ? '/ams/api' : '/ams/sandbox/api';
}

function getDomain(): string {
  return requireEnv('ANTOM_DOMAIN');
}

/** Signs an outgoing request per Antom's digital signature spec: POST <path>\n<clientId>.<requestTimeMs>.<rawBody> */
function signRequest(path: string, requestTimeMs: string, rawBody: string): string {
  const clientId = requireEnv('ANTOM_CLIENT_ID');
  const privateKeyPem = toPem(requireEnv('ANTOM_PRIVATE_KEY'), 'PRIVATE KEY');
  const content = `POST ${path}\n${clientId}.${requestTimeMs}.${rawBody}`;
  const signatureBytes = crypto.sign('RSA-SHA256', Buffer.from(content, 'utf8'), privateKeyPem);
  return encodeURIComponent(signatureBytes.toString('base64'));
}

interface AntomApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function callAntomApi<T = any>(path: string, body: Record<string, any>): Promise<AntomApiResult<T>> {
  const clientId = requireEnv('ANTOM_CLIENT_ID');
  const domain = getDomain();
  const rawBody = JSON.stringify(body);
  const requestTimeMs = Date.now().toString();
  const signature = signRequest(path, requestTimeMs, rawBody);

  const res = await fetch(`https://${domain}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Request-Time': requestTimeMs,
      'Signature': `algorithm=RSA256, keyVersion=1, signature=${signature}`,
    },
    body: rawBody,
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export interface CreateCashierPaymentParams {
  paymentRequestId: string;
  amountUSD: number;
  orderDescription: string;
  buyerEmail?: string;
  paymentRedirectUrl: string;
  paymentNotifyUrl?: string;
  terminalType?: 'WEB' | 'WAP' | 'APP';
}

export async function createCashierPayment(params: CreateCashierPaymentParams) {
  const path = `${getApiBasePath()}/v1/payments/pay`;

  const body: Record<string, any> = {
    productCode: 'CASHIER_PAYMENT',
    paymentRequestId: params.paymentRequestId,
    paymentAmount: {
      currency: 'USD',
      value: Math.round(params.amountUSD * 100).toString(),
    },
    paymentMethod: {
      paymentMethodType: 'CARD',
      paymentMethodMetaData: {
        is3DSAuthentication: false,
      },
    },
    paymentFactor: {
      isAuthorization: true,
      captureMode: 'AUTOMATIC',
    },
    settlementStrategy: {
      settlementCurrency: 'USD',
    },
    order: {
      referenceOrderId: params.paymentRequestId,
      orderDescription: params.orderDescription,
      orderAmount: {
        currency: 'USD',
        value: Math.round(params.amountUSD * 100).toString(),
      },
      buyer: {
        referenceBuyerId: params.paymentRequestId,
        ...(params.buyerEmail ? { buyerEmail: params.buyerEmail } : {}),
      },
    },
    env: {
      terminalType: params.terminalType || 'WEB',
    },
    paymentRedirectUrl: params.paymentRedirectUrl,
    ...(params.paymentNotifyUrl ? { paymentNotifyUrl: params.paymentNotifyUrl } : {}),
  };

  return callAntomApi(path, body);
}

export async function inquiryPayment(params: { paymentRequestId?: string; paymentId?: string }) {
  const path = `${getApiBasePath()}/v1/payments/inquiryPayment`;
  const body: Record<string, any> = {};
  if (params.paymentRequestId) body.paymentRequestId = params.paymentRequestId;
  if (params.paymentId) body.paymentId = params.paymentId;
  return callAntomApi(path, body);
}

/** Parses the `algorithm=RSA256, keyVersion=1, signature=...` Signature header into its parts. */
function parseSignatureHeader(header: string): { algorithm?: string; keyVersion?: string; signature?: string } {
  const parts = header.split(',').map(p => p.trim());
  const result: Record<string, string> = {};
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

/**
 * Verifies an inbound notifyPayment webhook signature.
 * `pathname` must be the path Antom actually called (our configured notify URL's path).
 */
export function verifyNotifySignature(params: {
  pathname: string;
  clientId: string;
  requestTime: string;
  signatureHeader: string;
  rawBody: string;
}): boolean {
  try {
    const antomPublicKeyPem = toPem(requireEnv('ANTOM_ANTOM_PUBLIC_KEY'), 'PUBLIC KEY');
    const { signature } = parseSignatureHeader(params.signatureHeader);
    if (!signature) return false;

    const content = `POST ${params.pathname}\n${params.clientId}.${params.requestTime}.${params.rawBody}`;
    const signatureBytes = Buffer.from(decodeURIComponent(signature), 'base64');

    return crypto.verify('RSA-SHA256', Buffer.from(content, 'utf8'), antomPublicKeyPem, signatureBytes);
  } catch (err) {
    console.error('[Antom] Signature verification error:', err);
    return false;
  }
}
