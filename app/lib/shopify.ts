import crypto from 'crypto';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[Shopify] Missing required env var: ${name}`);
  return value;
}

export const SHOPIFY_SCOPES = 'write_draft_orders,read_draft_orders,read_orders';

export function getAuthorizeUrl(redirectUri: string, state: string): string {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const clientId = requireEnv('SHOPIFY_CLIENT_ID');
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Verifies the HMAC Shopify attaches to OAuth callback query params. */
export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const secret = requireEnv('SHOPIFY_CLIENT_SECRET');
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join('&');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; scope: string }> {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const clientId = requireEnv('SHOPIFY_CLIENT_ID');
  const clientSecret = requireEnv('SHOPIFY_CLIENT_SECRET');

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Shopify] Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

interface AdminGraphQLResult<T> {
  ok: boolean;
  data?: T;
  errors?: any[];
}

export async function adminGraphQL<T = any>(query: string, variables?: Record<string, any>): Promise<AdminGraphQLResult<T>> {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';
  const accessToken = requireEnv('SHOPIFY_ACCESS_TOKEN');

  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    return { ok: false, data: json.data, errors: json.errors || [{ message: `HTTP ${res.status}` }] };
  }
  return { ok: true, data: json.data };
}

export interface DraftOrderAddress {
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface CreateDraftOrderParams {
  title: string;
  amountUSD: number;
  customerEmail?: string;
  note?: string;
  localOrderId: string;
  billingAddress?: DraftOrderAddress;
}

/** Creates a draft order with a single custom-priced line item and returns its invoice URL. */
export async function createDraftOrderInvoice(params: CreateDraftOrderParams) {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          totalPrice
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      email: params.customerEmail,
      note: params.note,
      tags: ['qb-enterprise', `localOrderId:${params.localOrderId}`],
      // Surfaced as checkout.attributes in the Order Status page's "Additional scripts",
      // used to build the post-payment redirect back to our own success page.
      customAttributes: [{ key: 'localOrderId', value: params.localOrderId }],
      billingAddress: params.billingAddress,
      lineItems: [
        {
          title: params.title,
          originalUnitPrice: params.amountUSD.toFixed(2),
          quantity: 1,
        },
      ],
    },
  };

  const result = await adminGraphQL<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string; invoiceUrl: string; totalPrice: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(mutation, variables);

  return result;
}

/** Looks up the real Order created from a completed draft order, by the localOrderId tag we set at creation. */
export async function findOrderByLocalOrderId(localOrderId: string) {
  const query = `
    query findOrder($search: String!) {
      orders(first: 1, query: $search) {
        edges {
          node {
            id
            name
            displayFinancialStatus
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
          }
        }
      }
    }
  `;
  const result = await adminGraphQL<{
    orders: { edges: { node: { id: string; name: string; displayFinancialStatus: string; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } } } }[] };
  }>(query, { search: `tag:'localOrderId:${localOrderId}'` });

  return result;
}

export async function registerOrdersPaidWebhook(callbackUrl: string) {
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id callbackUrl }
        userErrors { field message }
      }
    }
  `;
  return adminGraphQL(mutation, {
    topic: 'ORDERS_PAID',
    webhookSubscription: { callbackUrl, format: 'JSON' },
  });
}

/** Verifies the X-Shopify-Hmac-Sha256 header on inbound webhooks. */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
