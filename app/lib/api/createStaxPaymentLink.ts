export interface StaxPaymentParams {
  productPath?: string;
  quantity?: number;
  amountUSD?: number;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  agreedToTerms?: string;
  planDetails?: string;
}

export interface StaxPaymentResponse {
  checkoutUrl: string;
  invoiceId?: string;
}

export const createStaxPaymentLink = async (
  params: StaxPaymentParams
): Promise<StaxPaymentResponse> => {
  const response = await fetch('/api/stax/create-payment-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || 'Failed to create Stax payment link');
  }

  return response.json();
};
