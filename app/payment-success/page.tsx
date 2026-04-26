'use client';

import { CheckCircle, MailIcon, PackageIcon, HashIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

/**
 * Payment Success page
 *
 * FastSpring redirects here after a completed checkout.
 * It appends query params to the return URL:
 *   ?reference=FS-XXXXXXXX  (order reference)
 *   &order=<order_id>
 */
export default function PaymentSuccessPage() {
  const params = useSearchParams();

  // ── FastSpring return params ────────────────────────────────────────────────
  const fsReference = params.get('reference');
  const fsOrder = params.get('order');

  const hasDetails = fsReference || fsOrder;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 max-w-xl w-full text-center">
        <div className="flex flex-col items-center">
          <CheckCircle className="text-green-600 w-16 h-16 mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Payment Successful
          </h1>
          <p className="text-gray-600 mb-6">
            Your transaction has been completed. A confirmation email will be sent
            to you shortly by FastSpring.
          </p>

          {/* Transaction / Order Details */}
          {hasDetails && (
            <div className="w-full bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm text-gray-700 space-y-2">
              {fsReference && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 font-medium">
                    <HashIcon className="w-3.5 h-3.5" /> Order Reference:
                  </span>
                  <span className="text-gray-900 font-mono">{fsReference}</span>
                </div>
              )}
              {fsOrder && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 font-medium">
                    <PackageIcon className="w-3.5 h-3.5" /> Order ID:
                  </span>
                  <span className="text-gray-900 font-mono text-xs">{fsOrder}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            <p className="mb-1">Need help with your order?</p>
            <a
              href="mailto:billing@quickbooks-enterprises.com"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              <MailIcon className="w-4 h-4" />
              billing@quickbooks-enterprises.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
