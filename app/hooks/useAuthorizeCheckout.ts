import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const useAuthorizeCheckout = () => {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const localOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    /**
     * Listen for postMessage from IFrameCommunicator.html.
     * The communicator calls: window.top.postMessage({ source: 'authnet-communicator', qstr: '...' }, '*')
     * This works regardless of cross-origin iframe nesting depth.
     */
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data) return;

      /**
       * PRIMARY: Message from /api/authorize/complete (our own page loaded in the iframe).
       * Auth.net redirects the iframe to our page after payment. Since it's same-origin,
       * window.parent.postMessage always works — this is the guaranteed path.
       */
      if (event.data.source === 'authnet-complete') {
        console.log('[AuthNet] complete page signal received:', event.data);
        const { transId, syncSuccess } = event.data;

        // If server-side sync already succeeded, just close and redirect
        if (syncSuccess) {
          const popup = document.getElementById('authnet-popup-overlay');
          if (popup) popup.remove();
          router.push('/payment-success');
          return;
        }

        // Server sync failed — try client-side sync as fallback
        const orderId = localOrderIdRef.current;
        if (transId && orderId) {
          try {
            await fetch('/api/authorize/sync-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactionId: transId, localOrderId: orderId })
            });
          } catch (e) {
            console.error('[AuthNet] Fallback sync failed', e);
          }
        }

        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        router.push('/payment-success');
        return;
      }

      /**
       * FALLBACK: Message from IFrameCommunicator.html via window.top.postMessage.
       */
      if (event.data.source !== 'authnet-communicator') return;

      const qstr: string = event.data.qstr || '';
      console.log('[AuthNet] postMessage received, qstr:', qstr);

      const params = new URLSearchParams(qstr);
      const action = params.get('action');
      console.log('[AuthNet] action:', action);

      if (action === 'resizeWindow') {
        const height = params.get('height');
        const iframe = document.getElementById('authnet-iframe') as HTMLIFrameElement;
        if (iframe && height) iframe.style.height = `${height}px`;
        return;
      }

      if (action === 'cancel') {
        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        setIsPending(false);
        return;
      }

      if (action === 'transactResponse') {
        const responseRaw = params.get('response');
        console.log('[AuthNet] response raw:', responseRaw);
        let transId: string | null = null;

        if (responseRaw) {
          try {
            const responseObj = JSON.parse(responseRaw);
            transId = responseObj.transId;
            console.log('[AuthNet] transId:', transId);
          } catch (e) {
            console.error('[AuthNet] Failed to parse response JSON', e);
          }
        }

        const orderId = localOrderIdRef.current;
        console.log('[AuthNet] orderId from ref:', orderId);

        if (transId && orderId) {
          try {
            const syncRes = await fetch('/api/authorize/sync-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactionId: transId, localOrderId: orderId })
            });
            const syncData = await syncRes.json();
            console.log('[AuthNet] sync result:', syncData);

            const popup = document.getElementById('authnet-popup-overlay');
            if (popup) popup.remove();

            router.push('/payment-success');
          } catch (e) {
            console.error('[AuthNet] Failed to sync order', e);
            alert('Payment successful but failed to confirm automatically. Transaction ID: ' + transId + '. Please contact support.');
          }
        } else {
          console.warn('[AuthNet] Missing transId or orderId. transId:', transId, 'orderId:', orderId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  const checkout = async (paymentDetails: any) => {
    setIsPending(true);
    try {
      // 1. Create a pending order in MongoDB
      const sessionRes = await fetch('/api/authorize/start-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUSD: paymentDetails.amountUSD,
          email: paymentDetails.email,
          firstName: paymentDetails.firstName,
          lastName: paymentDetails.lastName,
          phone: paymentDetails.phone,
          planDetails: paymentDetails.planDetails,
          address: paymentDetails.address,
          city: paymentDetails.city,
          state: paymentDetails.state,
          zipCode: paymentDetails.zipCode,
          country: paymentDetails.country,
          companyName: paymentDetails.companyName,
          ein: paymentDetails.ein,
          agreedToTerms: paymentDetails.agreedToTerms,
          clientSignatureBase64: paymentDetails.clientSignatureBase64,
          gateway: 'Authorize.net'
        })
      });

      const sessionData = await sessionRes.json();
      if (!sessionData.localOrderId) throw new Error('Failed to create local session');

      // Store in ref so it's accessible in the message handler even after re-renders
      localOrderIdRef.current = sessionData.localOrderId;

      // 2. Fetch the Authorize.net hosted form token
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

      // 3. Build and show the overlay with the iframe
      const overlay = document.createElement('div');
      overlay.id = 'authnet-popup-overlay';
      overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';

      const isProd = process.env.NEXT_PUBLIC_AUTHORIZE_NET_IS_PRODUCTION === 'true';
      const actionUrl = isProd
        ? 'https://accept.authorize.net/payment/payment'
        : 'https://test.authorize.net/payment/payment';

      overlay.innerHTML = `
        <div class="relative w-full h-full flex flex-col bg-white" style="max-width:900px; height:95vh; border-radius:16px; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.4);">
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-bottom:1px solid #e5e7eb; background:#fff; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:10px;">
              <svg width="20" height="20" fill="none" stroke="#2ca01c" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              <span style="font-weight:600; font-size:15px; color:#111827;">Secure Payment</span>
            </div>
            <button onclick="document.getElementById('authnet-popup-overlay').remove()" style="width:32px;height:32px;border-radius:50%;border:none;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <!-- Loading spinner (hidden when iframe loads) -->
          <div id="authnet-spinner" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;z-index:1;">
            <svg style="animation:spin 1s linear infinite;width:36px;height:36px;color:#2ca01c;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p style="margin-top:12px;font-size:14px;color:#6b7280;font-weight:500;">Loading Secure Checkout...</p>
          </div>
          <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
          <!-- Iframe fills remaining space -->
          <iframe 
            name="authnet-iframe" 
            id="authnet-iframe" 
            onload="document.getElementById('authnet-spinner').style.display='none'"
            style="flex:1;width:100%;border:none;display:block;position:relative;z-index:2;">
          </iframe>
          <form id="authnet-form" action="${actionUrl}" method="POST" target="authnet-iframe" style="display:none;">
            <input type="hidden" name="token" value="${tokenData.token}" />
          </form>
        </div>
      `;

      document.body.appendChild(overlay);

      const form = document.getElementById('authnet-form') as HTMLFormElement;
      if (form) form.submit();

      setIsPending(false);

      // 4. Start polling — checks DB every 3 seconds for up to 10 minutes.
      //    The webhook will update the order to Completed when Auth.net fires it.
      //    This is the guaranteed close mechanism regardless of iframe issues.
      const orderId = sessionData.localOrderId;
      let attempts = 0;
      const maxAttempts = 200; // 200 × 3s = 10 minutes

      const pollInterval = setInterval(async () => {
        attempts++;

        // Stop if popup was manually closed or timed out
        if (!document.getElementById('authnet-popup-overlay') || attempts > maxAttempts) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const statusRes = await fetch(`/api/authorize/check-status?oid=${orderId}`);
          const statusData = await statusRes.json();
          console.log(`[AuthNet Poll] attempt ${attempts} — status: ${statusData.status}`);

          if (statusData.status === 'Completed') {
            clearInterval(pollInterval);
            const popup = document.getElementById('authnet-popup-overlay');
            if (popup) popup.remove();
            router.push('/payment-success');
          }
        } catch (e) {
          // Silent — keep polling
        }
      }, 3000);

    } catch (error) {
      setIsPending(false);
      throw error;
    }
  };

  return { checkout, isPending };
};
