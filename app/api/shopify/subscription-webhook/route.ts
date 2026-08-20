import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyWebhookHmac, formatCardLabel, adminGraphQL } from '@/app/lib/shopify';

/**
 * These subscription topics deliver a "thin" payload (mainly `admin_graphql_api_id`),
 * so every handler re-fetches the canonical object via Admin GraphQL rather than
 * trusting REST-style field names that Shopify doesn't document for these topics.
 */
function resolveGid(payload: any, typeName: string): string | null {
  if (typeof payload?.admin_graphql_api_id === 'string') return payload.admin_graphql_api_id;
  if (typeof payload?.id === 'string' && payload.id.startsWith('gid://')) return payload.id;
  if (payload?.id !== undefined) return `gid://shopify/${typeName}/${payload.id}`;
  return null;
}

async function handleContractCreate(db: any, payload: any) {
  const contractGid = resolveGid(payload, 'SubscriptionContract');
  if (!contractGid) {
    console.warn('[Shopify Subscription Webhook] contract create: no id in payload', JSON.stringify(payload));
    return;
  }

  const result = await adminGraphQL<{
    node: { id: string; customAttributes: { key: string; value: string }[]; originOrder: { id: string } | null } | null;
  }>(
    `query($id: ID!) {
      node(id: $id) {
        ... on SubscriptionContract {
          id
          customAttributes { key value }
          originOrder { id }
        }
      }
    }`,
    { id: contractGid }
  );

  const contract = result.data?.node;
  if (!contract) {
    console.warn('[Shopify Subscription Webhook] contract create: node lookup failed', contractGid, result.errors);
    return;
  }

  const localOrderId = contract.customAttributes?.find((a) => a.key === 'localOrderId')?.value;
  let record = localOrderId && ObjectId.isValid(localOrderId)
    ? await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) })
    : null;

  if (!record && contract.originOrder?.id) {
    const numericId = contract.originOrder.id.split('/').pop();
    record = await db.collection('admindata').findOne({ shopifyOrderNumericId: numericId });
  }

  if (!record) {
    console.warn('[Shopify Subscription Webhook] contract create: could not match to an admindata record', contractGid);
    return;
  }

  await db.collection('admindata').updateOne(
    { _id: record._id },
    { $set: { shopifySubscriptionContractId: contract.id, updatedAt: new Date() } }
  );

  console.log('[Shopify Subscription Webhook] Linked contract to record:', contract.id, record._id.toString());
}

async function handleBillingSuccess(db: any, payload: any) {
  const attemptGid = resolveGid(payload, 'SubscriptionBillingAttempt');
  if (!attemptGid) {
    console.warn('[Shopify Subscription Webhook] billing success: no id in payload', JSON.stringify(payload));
    return;
  }

  const result = await adminGraphQL<{
    node: {
      id: string;
      subscriptionContract: { id: string; customer: { email?: string } | null };
      transactions: {
        nodes: {
          status: string;
          kind: string;
          amountSet: { shopMoney: { amount: string } };
          paymentDetails: { company?: string; number?: string } | null;
          order: { id: string; name: string } | null;
        }[];
      };
    } | null;
  }>(
    `query($id: ID!) {
      node(id: $id) {
        ... on SubscriptionBillingAttempt {
          id
          subscriptionContract { id customer { email } }
          transactions(first: 5) {
            nodes {
              status
              kind
              amountSet { shopMoney { amount } }
              paymentDetails { ... on CardPaymentDetails { company number } }
              order { id name }
            }
          }
        }
      }
    }`,
    { id: attemptGid }
  );

  const attempt = result.data?.node;
  if (!attempt) {
    console.warn('[Shopify Subscription Webhook] billing success: node lookup failed', attemptGid, result.errors);
    return;
  }

  const successfulTxn = attempt.transactions?.nodes?.find(
    (t) => (t.kind === 'SALE' || t.kind === 'CAPTURE') && t.status === 'SUCCESS'
  );
  if (!successfulTxn) {
    console.warn('[Shopify Subscription Webhook] billing success: no successful transaction found', attemptGid);
    return;
  }

  const orderNumericId = successfulTxn.order?.id?.split('/').pop();

  // Already logged? (the very first charge is created via a real checkout and lands here
  // AND through orders/paid — orders/paid wins the race in practice, so skip duplicates.)
  const existing = orderNumericId
    ? await db.collection('admindata').findOne({ shopifyOrderNumericId: orderNumericId })
    : null;
  if (existing) {
    console.log('[Shopify Subscription Webhook] billing success: order already logged, skipping', orderNumericId);
    return;
  }

  const contract = attempt.subscriptionContract;
  const originalRecord = await db.collection('admindata').findOne({ shopifySubscriptionContractId: contract.id });

  const cardType = successfulTxn.paymentDetails?.company;
  const cardNumber = successfulTxn.paymentDetails?.number;
  const paymentMethodLabel = formatCardLabel(cardType, cardNumber);

  await db.collection('admindata').insertOne({
    firstName: originalRecord?.firstName,
    lastName: originalRecord?.lastName,
    email: originalRecord?.email || contract.customer?.email,
    phone: originalRecord?.phone,
    companyName: originalRecord?.companyName,
    ein: originalRecord?.ein,
    address: originalRecord?.address,
    city: originalRecord?.city,
    state: originalRecord?.state,
    zipCode: originalRecord?.zipCode,
    country: originalRecord?.country,
    amountUSD: Number(successfulTxn.amountSet?.shopMoney?.amount || 0),
    planDetails: originalRecord?.planDetails || 'QuickBooks Payroll (Monthly Subscription)',
    status: 'Completed',
    agreedToTerms: originalRecord?.agreedToTerms,
    clientSignatureBase64: originalRecord?.clientSignatureBase64,
    agreedTimestamp: originalRecord?.agreedTimestamp,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: new Date(),
    paymentGateway: 'Shopify Subscription',
    isSubscription: true,
    isRecurringCharge: true,
    subscriptionTier: originalRecord?.subscriptionTier,
    shopifySubscriptionContractId: contract.id,
    fsOrderReference: successfulTxn.order?.name ? `SHOPIFY-${successfulTxn.order.name}` : undefined,
    fsOrderId: successfulTxn.order?.id,
    shopifyOrderNumericId: orderNumericId,
    gateway: 'Shopify Subscription',
    cardType,
    cardLast4: cardNumber?.match(/(\d{4})\s*$/)?.[1],
    paymentMethodLabel,
    ipAddress: originalRecord?.ipAddress,
    deviceType: originalRecord?.deviceType,
    browser: originalRecord?.browser,
  });

  console.log('[Shopify Subscription Webhook] Logged recurring charge for contract:', contract.id);
}

async function handleBillingFailure(db: any, payload: any) {
  const attemptGid = resolveGid(payload, 'SubscriptionBillingAttempt');
  console.warn('[Shopify Subscription Webhook] Billing attempt failed:', attemptGid, JSON.stringify(payload));

  if (!attemptGid) return;

  const result = await adminGraphQL<{
    node: { id: string; subscriptionContract: { id: string } } | null;
  }>(
    `query($id: ID!) {
      node(id: $id) {
        ... on SubscriptionBillingAttempt {
          id
          subscriptionContract { id }
        }
      }
    }`,
    { id: attemptGid }
  );

  const contract = result.data?.node?.subscriptionContract;
  if (!contract) return;

  await db.collection('admindata').updateOne(
    { shopifySubscriptionContractId: contract.id },
    { $set: { lastBillingAttemptFailed: true, lastBillingAttemptFailedAt: new Date() } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');

    if (!verifyWebhookHmac(rawBody, hmacHeader)) {
      console.error('[Shopify Subscription Webhook] Invalid HMAC, ignoring');
      return NextResponse.json({ ok: true });
    }

    const payload = JSON.parse(rawBody);
    console.log('[Shopify Subscription Webhook] topic:', topic, 'payload:', rawBody);

    const { db } = await connectToDatabase();

    if (topic === 'subscription_contracts/create') {
      await handleContractCreate(db, payload);
    } else if (topic === 'subscription_billing_attempts/success') {
      await handleBillingSuccess(db, payload);
    } else if (topic === 'subscription_billing_attempts/failure') {
      await handleBillingFailure(db, payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Shopify Subscription Webhook Error]', error);
    return NextResponse.json({ ok: true });
  }
}
