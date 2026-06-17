import { useMutation } from '@tanstack/react-query';
import { createStaxPaymentLink, StaxPaymentParams } from '../lib/api/createStaxPaymentLink';

/**
 * useStaxCheckout
 *
 * Mutation hook that:
 *  1. Creates a Stax payment link / invoice server-side.
 *  2. Redirects the user to the generated checkout URL.
 *
 * Usage:
 *   const { checkout, isPending } = useStaxCheckout()
 *   checkout({ amountUSD: 850, email, firstName, lastName, ... })
 */
export const useStaxCheckout = () => {
  const mutation = useMutation({
    mutationFn: async (params: StaxPaymentParams) => {
      // Create the Stax session/invoice server-side
      const { checkoutUrl, invoiceId } = await createStaxPaymentLink(params);

      // Redirect to Stax hosted checkout
      console.log('[Stax] Redirecting to checkout:', checkoutUrl);
      window.location.href = checkoutUrl;

      return invoiceId;
    },
  });

  return {
    checkout: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
};
