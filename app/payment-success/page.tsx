'use client';

import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Mail, Hash, DollarSign, Package } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const params = useSearchParams();

  const transactionId = params.get('txn') || params.get('reference') || params.get('id');
  const amount = params.get('amount');
  const plan = params.get('plan');

  const paymentIntentId = params.get('payment_intent');
  const orderId = params.get('order_id');
  const gateway = params.get('gateway');
  // Only PayDollar sets this: its successUrl/failUrl/cancelUrl are display-only redirects, so the
  // real status still comes from the sync-order fallback below (or the Data Feed webhook).
  const outcome = params.get('outcome');
  const paydollarNotSuccessful = gateway === 'paydollar' && outcome && outcome !== 'success';

  useEffect(() => {
    // If returning from Stripe Custom Elements, verify the payment immediately
    // to act as a fallback in case the webhook fails or is delayed.
    if (paymentIntentId && orderId) {
      fetch('/api/stripe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent: paymentIntentId, order_id: orderId })
      }).catch(err => console.error('Verification fallback failed:', err));
    }
  }, [paymentIntentId, orderId]);

  useEffect(() => {
    // Antom redirects back before the webhook necessarily lands (especially on localhost
    // where Antom's servers can't reach our notify URL) — inquire directly as a fallback.
    if (gateway === 'antom' && orderId) {
      fetch('/api/antom/sync-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localOrderId: orderId })
      }).catch(err => console.error('Antom sync fallback failed:', err));
    }
  }, [gateway, orderId]);

  useEffect(() => {
    // Shopify's Order Status page redirects here via an "Additional scripts" snippet —
    // there's no webhook set up yet, so confirm payment directly against the Admin API.
    if (gateway === 'shopify' && orderId) {
      fetch('/api/shopify/sync-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localOrderId: orderId })
      }).catch(err => console.error('Shopify sync fallback failed:', err));
    }
  }, [gateway, orderId]);

  useEffect(() => {
    // PayDollar's redirect URLs are display-only; query the Merchant API directly as a fallback
    // in case the Data Feed webhook hasn't landed yet (or the customer bounced on failUrl/cancelUrl
    // after actually completing payment on PayDollar's side).
    if (gateway === 'paydollar' && orderId) {
      fetch('/api/paydollar/sync-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localOrderId: orderId })
      }).catch(err => console.error('PayDollar sync fallback failed:', err));
    }
  }, [gateway, orderId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-lg w-full">

        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-8">
          {paydollarNotSuccessful ? (
            <>
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
                <XCircle className="text-red-500 w-11 h-11" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {outcome === 'cancel' ? 'Payment Cancelled' : 'Payment Not Completed'}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                {outcome === 'cancel'
                  ? 'You cancelled the payment before it was completed. No charge was made.'
                  : 'PayDollar was unable to complete this payment. Please try again or contact us if the issue continues.'}
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5">
                <CheckCircle className="text-[#2ca01c] w-11 h-11" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Payment Successful!
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                Your payment has been processed and confirmed. A confirmation email will be sent to you shortly.
              </p>
            </>
          )}
        </div>

        {/* Detail rows */}
        <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
          {amount && (
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <span className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <DollarSign className="w-4 h-4" /> Amount Paid
              </span>
              <span className="text-sm font-bold text-gray-900">${parseFloat(amount).toFixed(2)} USD</span>
            </div>
          )}
          {plan && (
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <span className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <Package className="w-4 h-4" /> Plan
              </span>
              <span className="text-sm text-gray-800 text-right max-w-[60%] truncate">{plan}</span>
            </div>
          )}
          {transactionId && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <Hash className="w-4 h-4" /> Transaction ID
              </span>
              <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">{transactionId}</span>
            </div>
          )}
        </div>

        {/* Support */}
        <div className="text-center text-sm text-gray-500">
          <p className="mb-2">Questions about your order?</p>
          <a
            href="mailto:billing@quickbooks-enterprises.com"
            className="inline-flex items-center gap-1.5 text-[#2ca01c] hover:text-[#248a18] font-medium transition-colors"
          >
            <Mail className="w-4 h-4" />
            billing@quickbooks-enterprises.com
          </a>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}
