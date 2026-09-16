'use client';

import React, { useEffect, useRef, useState } from 'react';

const MOR_CHECKOUT_ORIGIN = 'https://pay.trymor.ai';

export default function MorPaymentForm({ checkoutUrl }: { checkoutUrl: string }) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [frameHeight, setFrameHeight] = useState(560);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== MOR_CHECKOUT_ORIGIN) return;

            if (event.data?.type === 'mor:height' && typeof event.data.height === 'number') {
                setFrameHeight(event.data.height);
            }
            // mor:result only updates the UI — the callback to /api/mor/webhook is the
            // authoritative outcome, so we just let the buyer know something happened here.
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!checkoutUrl) return null;

    return (
        <div className="w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Final Step: Complete Payment</h3>
            <iframe
                ref={frameRef}
                src={checkoutUrl}
                style={{ width: '100%', height: `${frameHeight}px`, border: 0 }}
                allow="payment"
                title="MOR.AI secure payment"
            />
            <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1 mt-4">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm9 13H6v-8h12v8z"/></svg>
                Payments are securely encrypted and processed by MOR.AI
            </p>
        </div>
    );
}
