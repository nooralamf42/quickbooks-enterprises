'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Load Stripe using the publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

function CheckoutForm({ localOrderId }: { localOrderId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | undefined>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsProcessing(true);

        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const base = isLocalhost ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.quickbooks-enterprises.com');

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Ensure this points to our own payment success page
                return_url: `${base}/payment-success?order_id=${localOrderId}`,
            },
        });

        if (error) {
            setErrorMessage(error.message);
            setIsProcessing(false);
        } else {
            // Payment succeeded, will redirect automatically
        }
    };

    return (
        <div className="w-full flex flex-col gap-5">
            <PaymentElement />
            
            {errorMessage && (
                <div className="text-red-500 text-sm mt-2 font-medium bg-red-50 p-3 rounded-md border border-red-100">
                    {errorMessage}
                </div>
            )}
            
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!stripe || isProcessing}
                className="w-full bg-[#20B038] hover:bg-[#1a952d] text-white py-3.5 px-6 rounded-lg shadow font-medium transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Processing Securely...' : 'Pay Securely'}
            </button>
            <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm9 13H6v-8h12v8z"/></svg>
                Payments are securely encrypted and processed by Stripe
            </p>
        </div>
    );
}

export default function StripePaymentForm({ clientSecret, localOrderId }: { clientSecret: string, localOrderId: string }) {
    if (!clientSecret) return null;

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Final Step: Complete Payment</h3>
            <Elements stripe={stripePromise} options={{ 
                clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#20B038',
                        colorBackground: '#ffffff',
                        colorText: '#30313d',
                        colorDanger: '#df1b41',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '8px',
                    }
                } 
            }}>
                <CheckoutForm localOrderId={localOrderId} />
            </Elements>
        </div>
    );
}
