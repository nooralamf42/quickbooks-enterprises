import crypto from 'crypto';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[Shopify] Missing required env var: ${name}`);
  return value;
}

export const SHOPIFY_SCOPES = 'write_draft_orders,read_draft_orders,read_orders,read_products,write_products,read_purchase_options,write_purchase_options,read_own_subscription_contracts,write_own_subscription_contracts,read_publications,write_publications,unauthenticated_write_checkouts,unauthenticated_read_checkouts,unauthenticated_read_product_listings,unauthenticated_read_selling_plans';

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
  /** Two-letter region code (e.g. "VA") — Shopify's MailingAddressInput field is provinceCode, not province. */
  provinceCode?: string;
  zip?: string;
  /** Two-letter country code (e.g. "US") — Shopify's MailingAddressInput field is countryCode, not country. */
  countryCode?: string;
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

// Representative product used so QuickBooks Enterprise edition purchases (any custom price)
// show a real image at checkout instead of the generic placeholder icon. Custom services
// (Payroll, Consulting, etc.) still fall back to a plain custom line item until they get
// their own mapped product/image.
const QUICKBOOKS_ENTERPRISE_VARIANT_ID = 'gid://shopify/ProductVariant/54230108504428';

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

  const isQuickBooksEdition = params.title?.toLowerCase().startsWith('quickbooks enterprise');

  const variables = {
    input: {
      email: params.customerEmail,
      note: params.note,
      tags: ['qb-enterprise', `localOrderId:${params.localOrderId}`],
      // Surfaced as checkout.attributes in the Order Status page's "Additional scripts",
      // used to build the post-payment redirect back to our own success page.
      customAttributes: [{ key: 'localOrderId', value: params.localOrderId }],
      billingAddress: params.billingAddress,
      // Mirrored so Shopify's checkout "Delivery" step (which reads shippingAddress, not
      // billingAddress) is prefilled too, instead of showing up blank.
      shippingAddress: params.billingAddress,
      lineItems: [
        isQuickBooksEdition
          ? {
              variantId: QUICKBOOKS_ENTERPRISE_VARIANT_ID,
              priceOverride: { amount: params.amountUSD.toFixed(2), currencyCode: 'USD' },
              quantity: 1,
            }
          : {
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
            transactions(first: 5) {
              kind
              status
              paymentDetails {
                ... on CardPaymentDetails {
                  company
                  number
                }
              }
            }
          }
        }
      }
    }
  `;
  const result = await adminGraphQL<{
    orders: {
      edges: {
        node: {
          id: string;
          name: string;
          displayFinancialStatus: string;
          totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
          transactions: { kind: string; status: string; paymentDetails: { company?: string; number?: string } | null }[];
        };
      }[];
    };
  }>(query, { search: `tag:'localOrderId:${localOrderId}'` });

  return result;
}

/** Builds a "Visa ending in 4242" style label from Shopify's card payment details, matching other gateways. */
export function formatCardLabel(company?: string, maskedNumber?: string): string {
  const last4 = maskedNumber?.match(/(\d{4})\s*$/)?.[1];
  if (!last4) return 'Card on file';
  return `${company || 'Card'} ending in ${last4}`;
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

export const PAYROLL_SUBSCRIPTION_SELLING_PLAN_ID = 'gid://shopify/SellingPlan/693802336620';

export const PAYROLL_SUBSCRIPTION_VARIANTS: Record<string, string> = {
  '49.87': 'gid://shopify/ProductVariant/54224799433068',
  '98.78': 'gid://shopify/ProductVariant/54224800579948',
  '149.10': 'gid://shopify/ProductVariant/54224800612716',
  '198.70': 'gid://shopify/ProductVariant/54224800645484',
  '298.00': 'gid://shopify/ProductVariant/54224800678252',
  '349.89': 'gid://shopify/ProductVariant/54224800711020',
};

export interface SubscriptionCheckoutParams {
  tier: string;
  localOrderId?: string;
  email?: string;
}

/** Creates a fresh Storefront API cart for a QuickBooks Payroll subscription tier and returns its checkout URL. */
export async function createSubscriptionCheckoutUrl(params: SubscriptionCheckoutParams): Promise<string | null> {
  const variantId = PAYROLL_SUBSCRIPTION_VARIANTS[params.tier];
  if (!variantId) return null;

  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const storefrontToken = requireEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';

  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  const res = await fetch(`https://${shop}/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          lines: [{ merchandiseId: variantId, quantity: 1, sellingPlanId: PAYROLL_SUBSCRIPTION_SELLING_PLAN_ID }],
          // Cart attributes are carried through to the resulting Order's note_attributes,
          // which is how the orders/paid webhook ties the Shopify order back to our Mongo record.
          attributes: params.localOrderId ? [{ key: 'localOrderId', value: params.localOrderId }] : undefined,
          buyerIdentity: params.email ? { email: params.email } : undefined,
        },
      },
    }),
  });

  const json = await res.json();
  return json?.data?.cartCreate?.cart?.checkoutUrl ?? null;
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
