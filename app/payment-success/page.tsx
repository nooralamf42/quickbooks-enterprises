'use client';

import { CheckCircle, Mail, Hash, DollarSign, Package } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const params = useSearchParams();

  const transactionId = params.get('txn') || params.get('reference') || params.get('id');
  const amount = params.get('amount');
  const plan = params.get('plan');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-lg w-full">

        {/* Icon + heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5">
            <CheckCircle className="text-[#2ca01c] w-11 h-11" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
            Your payment has been processed and confirmed. A confirmation email will be sent to you shortly.
          </p>
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
