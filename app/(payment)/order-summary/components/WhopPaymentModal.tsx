'use client';

import { useEffect, useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { WhopCheckoutEmbed, useCheckoutEmbedControls } from '@whop/checkout/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  amountUSD: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  planDetails?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  clientSignatureBase64?: string;
}

export default function WhopPaymentModal({
  isOpen,
  onClose,
  amountUSD,
  firstName,
  lastName,
  email,
  phone,
  planDetails,
  address,
  city,
  state,
  zipCode,
  country,
  clientSignatureBase64,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const embedControls = useCheckoutEmbedControls();

  // The iframe ignores URL prefill when it already remembers a previous
  // buyer identity, so push the form values in once the embed is ready.
  const applyPrefill = () => {
    embedControls.current?.setEmail(email).catch(() => {});
    if (address && city && state && zipCode && country) {
      embedControls.current
        ?.setAddress({
          name: `${firstName} ${lastName}`.trim(),
          line1: address,
          city,
          state,
          postalCode: zipCode,
          country,
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSessionId(null);
      setErrorMsg('');
      setIsLoading(false);
      return;
    }

    const initCheckout = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/whop/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUSD, firstName, lastName, email, phone,
            planDetails, address, city, state, zipCode, country,
            clientSignatureBase64
          })
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to initialize checkout');
        }

        if (!data.sessionId) {
          throw new Error('No checkout session returned');
        }

        setSessionId(data.sessionId);
        setLocalOrderId(data.localOrderId);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Failed to initialize Whop checkout. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initCheckout();
  }, [isOpen, amountUSD, firstName, lastName, email, phone, planDetails, address, city, state, zipCode, country]);

  if (!isOpen) return null;

  // We define a return URL based on current origin if running in browser
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const returnUrl = `${baseUrl}/payment-success?amount=${amountUSD}&plan=${encodeURIComponent(planDetails || '')}&localOrderId=${localOrderId}`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200" style={{ height: '850px' }}>

        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 p-2 rounded-full transition-all"
          aria-label="Close checkout"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content area */}
        <div className="flex-1 w-full h-full relative min-h-[500px]">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 px-8 text-center bg-white">
              <div className="w-8 h-8 border-2 border-[#2ca01c] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Loading secure payment form…</p>
            </div>
          )}

          {errorMsg && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 px-8 text-center bg-white">
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-base text-red-500 font-medium">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-4 text-sm text-gray-500 hover:text-gray-800 transition-colors underline"
              >
                Close and try again
              </button>
            </div>
          )}

          {sessionId && !isLoading && (
            <div className="w-full h-full overflow-y-auto">
              <WhopCheckoutEmbed
                ref={embedControls}
                sessionId={sessionId}
                returnUrl={returnUrl}
                onStateChange={(embedState) => {
                  if (embedState === 'ready') applyPrefill();
                }}
                theme="light"
                themeOptions={{
                  accentColor: '#2ca01c',
                  backgroundColor: '#ffffff',
                }}
                prefill={{
                  email,
                  address: {
                    name: `${firstName} ${lastName}`.trim(),
                    line1: address,
                    city,
                    state,
                    postalCode: zipCode,
                    country,
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
