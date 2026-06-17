'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    StaxJs: any;
  }
}

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
}

function VisaIcon() {
  return (
    <svg viewBox="0 0 50 16" className="h-5 w-auto" aria-label="Visa">
      <rect width="50" height="16" rx="3" fill="#1A1F71" />
      <text x="8" y="12" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">VISA</text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto" aria-label="Mastercard">
      <rect width="38" height="24" rx="3" fill="#252525" />
      <circle cx="14" cy="12" r="8" fill="#EB001B" />
      <circle cx="24" cy="12" r="8" fill="#F79E1B" />
      <path d="M19 6.8a8 8 0 0 1 0 10.4A8 8 0 0 1 19 6.8z" fill="#FF5F00" />
    </svg>
  );
}

function AmexIcon() {
  return (
    <svg viewBox="0 0 50 16" className="h-5 w-auto" aria-label="American Express">
      <rect width="50" height="16" rx="3" fill="#2E77BC" />
      <text x="5" y="12" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">AMEX</text>
    </svg>
  );
}

function DiscoverIcon() {
  return (
    <svg viewBox="0 0 50 16" className="h-5 w-auto" aria-label="Discover">
      <rect width="50" height="16" rx="3" fill="#231F20" />
      <circle cx="36" cy="8" r="7" fill="#F76F20" />
      <text x="4" y="12" fill="white" fontSize="7.5" fontWeight="bold" fontFamily="Arial">DISCOVER</text>
    </svg>
  );
}

export default function StaxPaymentModal({
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
}: Props) {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [cardName, setCardName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const staxRef = useRef<any>(null);
  const initStartedRef = useRef(false);
  const savedConsoleErrorRef = useRef<typeof console.error | null>(null);

  // Pre-fill cardholder name from billing info
  useEffect(() => {
    if (isOpen && firstName) {
      setCardName(`${firstName} ${lastName}`.trim());
    }
  }, [isOpen, firstName, lastName]);

  useEffect(() => {
    if (!isOpen) {
      staxRef.current = null;
      initStartedRef.current = false;
      setIsReady(false);
      setExpiry('');
      setCardName('');
      setErrorMsg('');
      setLoadError('');
      if (savedConsoleErrorRef.current) {
        console.error = savedConsoleErrorRef.current;
        savedConsoleErrorRef.current = null;
      }
      return;
    }

    // Stax.js tries NMI (Collect.js) as a fallback backend. Collect.js calls
    // console.error when it fails to init. In Next.js dev mode that becomes a
    // blocking error overlay. We filter those specific messages for the entire
    // lifetime of the modal (NMI retries fire asynchronously after showCardForm
    // resolves, so we can't restore sooner).
    if (!savedConsoleErrorRef.current) {
      savedConsoleErrorRef.current = console.error;
      console.error = (...args: any[]) => {
        const msg = String(args[0] ?? '');
        if (
          msg.includes('PaymentRequestAbstraction') ||
          msg.includes('vendor tokenizer') ||
          msg.includes('Collect.js') ||
          msg.includes('networkmerchants')
        ) return;
        savedConsoleErrorRef.current!(...args);
      };
    }

    if (initStartedRef.current) return;
    initStartedRef.current = true;

    requestAnimationFrame(() => {
      const init = async () => {
        if (!window.StaxJs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://staxjs.staxpayments.com/stax.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Could not load Stax.js'));
            document.head.appendChild(script);
          });
        }

        const stax = new window.StaxJs(process.env.NEXT_PUBLIC_STAX_PUBLIC_KEY!, {
          number: {
            id: 'stax-number',
            placeholder: '1234 5678 9012 3456',
            style: 'font-size:14px; height:36px; width:100%; color:#111827; background:transparent;',
            type: 'text',
            format: 'prettyFormat',
          },
          cvv: {
            id: 'stax-cvv',
            placeholder: '•••',
            style: 'font-size:14px; height:36px; width:100%; color:#111827; background:transparent;',
            type: 'text',
          },
        });

        await stax.showCardForm();
        staxRef.current = stax;
        setIsReady(true);
      };

      init().catch((err) => {
        savedConsoleErrorRef.current?.('[Stax.js]', err);
        setLoadError('Failed to load the payment form. Please refresh the page and try again.');
      });
    });
  }, [isOpen]);

  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
      setExpiry(digits);
    } else {
      setExpiry(digits.slice(0, 2) + ' / ' + digits.slice(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staxRef.current) return;

    const parts = expiry.split(' / ');
    const paddedMonth = (parts[0] || '').padStart(2, '0');
    const yearVal = parts[1] || '';

    if (!paddedMonth || !yearVal) {
      setErrorMsg('Please enter your card expiry date.');
      return;
    }

    setErrorMsg('');
    setIsProcessing(true);
    try {
      // Log "payment started" in MongoDB
      let localOrderId: string | undefined;
      try {
        const startRes = await fetch('/api/stax/start-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName, lastName, email, phone,
            address, city, state, zipCode, country,
            amountUSD, planDetails,
          }),
        });
        const startData = await startRes.json();
        localOrderId = startData.localOrderId;
      } catch (_) {
        // Non-fatal — proceed with payment even if logging fails
      }

      let token: any;
      try {
        token = await staxRef.current.tokenize({
          customer_firstname: firstName || '',
          customer_lastname: lastName || '',
          customer_email: email || '',
          month: paddedMonth,
          year: yearVal.length === 4 ? yearVal.slice(-2) : yearVal,
          address_1: address || '',
          address_city: city || '',
          address_state: state || '',
          address_zip: zipCode || '',
          address_country: country || 'US',
        });
      } catch (err: any) {
        throw new Error(err?.message || 'Card tokenization failed. Please check your card details.');
      }

      const res = await fetch('/api/stax/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: token.id,
          amountUSD,
          email,
          firstName,
          lastName,
          planDetails,
          localOrderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment processing failed.');
      }

      const params = new URLSearchParams({
        txn: data.transactionId || '',
        amount: amountUSD.toFixed(2),
        ...(planDetails ? { plan: planDetails } : {}),
      });
      window.location.href = `/payment-success?${params.toString()}`;
    } catch (err: any) {
      setErrorMsg(err?.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass =
    'w-full border border-gray-200 rounded-xl px-4 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent transition';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[420px] overflow-hidden">

        {/* ── Dark header ── */}
        <div className="relative bg-gradient-to-br from-[#1b2a1b] to-[#243324] px-6 pt-7 pb-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white/90 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <p className="text-white/50 text-[11px] uppercase tracking-widest font-semibold mb-2">
            Secure Checkout
          </p>
          <p className="text-white text-4xl font-bold tracking-tight">
            ${amountUSD.toFixed(2)}
          </p>
          {planDetails && (
            <p className="text-white/60 text-sm mt-1 truncate">{planDetails}</p>
          )}

          {/* Card brand logos */}
          <div className="flex items-center gap-2 mt-5">
            <VisaIcon />
            <MastercardIcon />
            <AmexIcon />
            <DiscoverIcon />
          </div>
        </div>

        {/* ── White card pulled over header ── */}
        <div className="relative -mt-5 bg-white rounded-t-3xl px-6 pt-6 pb-7">

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Cardholder name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Cardholder Name
              </label>
              <input
                type="text"
                placeholder="Full name on card"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                required
                className={`${fieldClass} h-[44px]`}
              />
            </div>

            {/* Card number — Stax iframe */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Card Number
              </label>
              <div
                id="stax-number"
                className="border border-gray-200 rounded-xl px-4 bg-white focus-within:ring-2 focus-within:ring-[#2ca01c] flex items-center overflow-hidden"
                style={{ height: '44px' }}
              />
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Expiry
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM / YY"
                  value={expiry}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  maxLength={7}
                  required
                  className={`${fieldClass} h-[44px]`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  CVV
                </label>
                <div
                  id="stax-cvv"
                  className="border border-gray-200 rounded-xl px-4 bg-white focus-within:ring-2 focus-within:ring-[#2ca01c] flex items-center overflow-hidden"
                  style={{ height: '44px' }}
                />
              </div>
            </div>

            {/* Billing summary */}
            {email && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700">
                  {firstName} {lastName}
                </p>
                <p>{email}</p>
                {city && state && <p>{city}, {state} {zipCode}</p>}
              </div>
            )}

            {/* Inline error */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 leading-snug">{errorMsg}</p>
              </div>
            )}

            {/* Pay button */}
            <button
              type="submit"
              disabled={isProcessing || !isReady}
              className="w-full flex items-center justify-center gap-2 bg-[#2ca01c] hover:bg-[#258518] active:bg-[#1f6e14] text-white py-4 rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-900/20"
            >
              <Lock className="w-4 h-4" />
              {isProcessing ? 'Processing payment…' : `Pay $${amountUSD.toFixed(2)}`}
            </button>
          </form>

          {/* Trust footer */}
          <div className="flex items-center justify-center gap-2 mt-5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span>256-bit SSL</span>
            <span className="text-gray-300">·</span>
            <span>PCI DSS Level 1</span>
            <span className="text-gray-300">·</span>
            <span>Powered by Stax</span>
          </div>
        </div>

        {/* Loading / load-error overlay */}
        {!isReady && (
          <div className="absolute inset-0 bg-white/95 rounded-3xl flex flex-col items-center justify-center gap-3 z-10 px-8 text-center">
            {loadError ? (
              <>
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-600 font-medium">{loadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-1 text-xs text-[#2ca01c] underline underline-offset-2"
                >
                  Refresh page
                </button>
              </>
            ) : (
              <>
                <div className="w-7 h-7 border-2 border-[#2ca01c] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Loading secure payment form…</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
