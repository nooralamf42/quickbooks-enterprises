import { useMutation } from '@tanstack/react-query';
import {
  createFastspringSession,
  FastspringSessionParams,
} from '../lib/api/createFastspringSession';

// Extend window to include the FastSpring SBL global
declare global {
  interface Window {
    fastspring?: {
      builder: {
        push: (data: Record<string, any>) => void;
        checkout: () => void;
        reset: () => void;
      };
    };
  }
}

/**
 * Waits for window.fastspring to be available (SBL fully loaded).
 * Polls every 150 ms for up to `timeoutMs` milliseconds.
 * Resolves true if found, false if timed out.
 */
function waitForFastspring(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.fastspring?.builder) return resolve(true);

    const start = Date.now();
    const interval = setInterval(() => {
      if (window.fastspring?.builder) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        console.warn('[FastSpring] SBL did not load within', timeoutMs, 'ms — falling back to redirect');
        resolve(false);
      }
    }, 150);
  });
}

/**
 * useFastspringCheckout
 *
 * Mutation hook that:
 *  1. Creates a FastSpring session server-side (API keys stay safe)
 *  2. Waits for the SBL popup library to be ready (up to 5 s)
 *  3. Opens the FastSpring POPUP checkout modal on your page
 *  4. Falls back to full-page redirect if SBL never loads
 *
 * Usage:
 *   const { checkout, isPending } = useFastspringCheckout()
 *   checkout({ amountUSD: 850, email, firstName, lastName, ... })
 */
export const useFastspringCheckout = () => {
  const mutation = useMutation({
    mutationFn: async (params: FastspringSessionParams) => {
      // Step 1: Create the session server-side
      const { sessionId, checkoutUrl } = await createFastspringSession(params);

      // Step 2: Wait for SBL to be available
      const sblReady = await waitForFastspring(5000);

      if (sblReady && window.fastspring?.builder) {
        // Step 3a: Open popup modal with the pre-created session ID
        console.log('[FastSpring] Opening popup for session:', sessionId);
        window.fastspring.builder.checkout(sessionId);
      } else {
        // Step 3b: SBL timed out — redirect to FastSpring hosted checkout
        console.warn('[FastSpring] Using redirect fallback:', checkoutUrl);
        window.location.href = checkoutUrl;
      }

      return sessionId;
    },
  });

  return {
    checkout: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
};
