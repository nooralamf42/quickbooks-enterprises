export interface FastspringSessionParams {
  productPath: string;       // FastSpring product path/ID configured in your catalog
  quantity?: number;
  amountUSD?: number;        // Override the catalog price (admin-set amount in dollars)
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
  planDetails?: string;      // Optional custom plan description/name for services
}

export interface FastspringSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export const createFastspringSession = async (
  params: FastspringSessionParams
): Promise<FastspringSessionResponse> => {
  const response = await fetch('/api/fastspring/create-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || 'Failed to create FastSpring session');
  }

  return response.json();
};
