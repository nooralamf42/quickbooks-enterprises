import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * This endpoint is called by Authorize.net after a successful payment.
 * Auth.net navigates the iframe to this URL (GET or POST).
 * We sync the DB here, then return an HTML page that uses window.parent.postMessage
 * to signal the checkout page (same-origin, guaranteed to work) to close the popup.
 */

async function handleComplete(req: NextRequest) {
  // Auth.net sends transId in query string and/or POST body
  let transId = req.nextUrl.searchParams.get('transId');
  const orderId = req.nextUrl.searchParams.get('oid');

  // Also try POST form data
  if (!transId && req.method === 'POST') {
    try {
      const formData = await req.formData();
      transId = formData.get('transId') as string;
    } catch (_) {}
  }

  console.log('[AuthNet Complete] transId:', transId, 'orderId:', orderId);

  // Attempt DB sync server-side
  let syncSuccess = false;
  if (transId && orderId) {
    try {
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
      const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';
      const endpoint = isProd
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api';

      const verifyRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          getTransactionDetailsRequest: {
            merchantAuthentication: { name: apiLoginId, transactionKey },
            transId
          }
        })
      });
      const verifyData = await verifyRes.json();
      const transaction = verifyData?.transaction;

      if (transaction && transaction.responseCode === 1) {
        const { db } = await connectToDatabase();
        const record = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });

        if (record) {
          await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            {
              $set: {
                status: 'Completed',
                authNetTransactionId: transId,
                paidAt: new Date(),
                updatedAt: new Date()
              }
            }
          );

          // Customer receipt emails are sent manually from the admin dashboard, not automatically here.

          syncSuccess = true;
        }
      }
    } catch (err) {
      console.error('[AuthNet Complete] Sync error:', err);
    }
  }

  // Return HTML page that posts a message to window.parent (our checkout page)
  // Since this page is on our domain, window.parent is same-origin and postMessage is guaranteed to work
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Payment Complete</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
    .box { text-align: center; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e5e7eb; border-top-color: #2ca01c; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <p>Payment confirmed. Redirecting...</p>
  </div>
  <script>
    var transId = ${JSON.stringify(transId || null)};
    var orderId = ${JSON.stringify(orderId || null)};
    var syncSuccess = ${JSON.stringify(syncSuccess)};
    
    // window.parent is our checkout page (same-origin) — this always works
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        source: 'authnet-complete',
        transId: transId,
        orderId: orderId,
        syncSuccess: syncSuccess
      }, window.location.origin);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

export async function GET(req: NextRequest) {
  return handleComplete(req);
}

export async function POST(req: NextRequest) {
  return handleComplete(req);
}
