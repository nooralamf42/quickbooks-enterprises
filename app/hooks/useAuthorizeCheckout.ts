import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const useAuthorizeCheckout = () => {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // We need to define the global handler for Authorize.net IFrameCommunicator
    (window as any).CommunicationHandler = async (queryString: string) => {
      // queryString arrives already stripped of leading ? or #
      // e.g. "action=transactResponse&response={...}"
      const params = new URLSearchParams(queryString);
      const action = params.get('action');
      console.log('[AuthNet] CommunicationHandler received action:', action, 'raw:', queryString);
      
      let transId = null;
      const responseStr = params.get('response');
      if (responseStr) {
        try {
          const responseObj = JSON.parse(responseStr);
          transId = responseObj.transId;
          console.log('[AuthNet] Parsed transId:', transId);
        } catch (e) {
          console.error('[AuthNet] Failed to parse response payload', e);
        }
      }

      const orderId = (window as any).__authNetLocalOrderId;

      if (action === 'transactResponse' || action === 'successfulSave') {
        if (transId && orderId) {
          // Sync with our backend
          try {
            const syncRes = await fetch('/api/authorize/sync-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactionId: transId, localOrderId: orderId })
            });
            const syncData = await syncRes.json();
            
            // Clean up UI
            const popup = document.getElementById('authnet-popup-overlay');
            if (popup) popup.remove();

            // Redirect
            router.push('/payment-success');
          } catch (e) {
            console.error('Failed to sync Auth.net order', e);
            alert('Payment successful, but failed to sync locally. Please contact support.');
          }
        }
      } else if (action === 'cancel') {
        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        setIsPending(false);
      }
    };
  }, [router]);

  const checkout = async (paymentDetails: any) => {
    setIsPending(true);
    try {
      // 1. Create a local order in MongoDB first (reusing existing API, but we'll adapt it or just create a log)
      // Actually, we can use the same session creation but intercept it, or just generate the token.
      // Wait, we need the localOrderId to track it.
      const sessionRes = await fetch('/api/fastspring/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentDetails, gateway: 'Authorize.net' })
      });
      
      const sessionData = await sessionRes.json();
      if (!sessionData.localOrderId) throw new Error('Failed to create local session');

      (window as any).__authNetLocalOrderId = sessionData.localOrderId;

      // 2. Fetch the Authorize.net form token
      const tokenRes = await fetch('/api/authorize/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentDetails.amountUSD,
          customerInfo: paymentDetails,
          orderId: sessionData.localOrderId
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error('Failed to generate Auth.net token');

      // 3. Render the full-screen iframe overlay
      const overlay = document.createElement('div');
      overlay.id = 'authnet-popup-overlay';
      overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
      
      const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';
      const actionUrl = isProd ? 'https://accept.authorize.net/payment/payment' : 'https://test.authorize.net/payment/payment';

      overlay.innerHTML = `
        <div class="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button onclick="document.getElementById('authnet-popup-overlay').remove()" class="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <div id="authnet-iframe-container" class="w-full h-[85vh] relative">
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-white text-gray-500">
              <svg class="animate-spin h-8 w-8 mb-4 text-[#0075ff]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p class="font-medium">Loading Secure Checkout...</p>
            </div>
            <iframe name="authnet-iframe" id="authnet-iframe" class="relative z-10 w-full h-full border-0"></iframe>
          </div>
          <form id="authnet-form" action="${actionUrl}" method="POST" target="authnet-iframe">
            <input type="hidden" name="token" value="${tokenData.token}" />
          </form>
        </div>
      `;

      document.body.appendChild(overlay);
      
      // Submit the form into the iframe
      const form = document.getElementById('authnet-form') as HTMLFormElement;
      if (form) form.submit();

      setIsPending(false);

    } catch (error) {
      setIsPending(false);
      throw error;
    }
  };

  return { checkout, isPending };
};
