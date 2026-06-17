import { NextResponse } from 'next/server';

const STAX_API_URL = 'https://apiprod.fattlabs.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amountUSD, email, firstName, lastName, phone, planDetails } = body;

    const apiKey = process.env.STAX_API_KEY;
    const hostedToken = process.env.NEXT_PUBLIC_STAX_PUBLIC_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Stax API key is not configured' }, { status: 500 });
    }

    if (!amountUSD) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    const successUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success`
      : 'https://www.quickbooks-enterprise.us/payment-success';

    // Stax Invoice API — works without the Payment Links feature being enabled.
    // The invoice payment URL is: https://app.staxpayments.com/#/pay/{token}/{invoiceId}
    const invoicePayload = {
      total: amountUSD,
      url: successUrl,
      meta: {
        memo: planDetails || 'QuickBooks Enterprise Subscription',
        subtotal: amountUSD,
      },
      customer: {
        firstname: firstName || '',
        lastname: lastName || '',
        email: email || '',
        phone: phone || '',
      },
    };

    console.log('[Stax] Creating invoice:', JSON.stringify(invoicePayload, null, 2));

    const staxResponse = await fetch(`${STAX_API_URL}/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    const responseText = await staxResponse.text();

    if (!staxResponse.ok) {
      console.error('[Stax] Error creating invoice:', staxResponse.status, responseText);
      return NextResponse.json(
        { error: 'Failed to create Stax invoice', detail: responseText },
        { status: staxResponse.status }
      );
    }

    const invoice = JSON.parse(responseText);
    console.log('[Stax] Invoice created:', invoice.id);

    // Activate the invoice so it is payable via the hosted payment URL.
    // DRAFT invoices may be blocked; PUT /send changes status to SENT.
    if (email) {
      await fetch(`${STAX_API_URL}/invoice/${invoice.id}/send`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ customer_email: email }),
      }).catch((err) => console.warn('[Stax] Could not send invoice:', err));
    }

    // Hosted payment URL with the invoice pre-loaded (amount is pre-filled for the customer)
    const checkoutUrl = `https://app.staxpayments.com/#/pay/${hostedToken}/invoice/${invoice.id}`;

    return NextResponse.json({
      checkoutUrl,
      invoiceId: invoice.id,
    });
  } catch (error: any) {
    console.error('[Stax API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error?.message }, { status: 500 });
  }
}
