import { NextRequest, NextResponse } from 'next/server';

const FASTSPRING_API_URL = 'https://api.fastspring.com/sessions';

/**
 * POST /api/fastspring/create-session
 *
 * Creates a FastSpring checkout session using Session API v2.
 * Returns a `checkoutUrl` that the frontend redirects the user to.
 *
 * Key feature: `amountUSD` overrides the catalog price, so the admin-set
 * total from the payment link is what FastSpring charges — not the product's
 * default catalog price.
 *
 * Docs: https://developer.fastspring.com/docs/create-a-session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      productPath,
      quantity = 1,
      amountUSD,          // admin-set price override (dollars, e.g. 499.00)
      firstName,
      lastName,
      email,
      companyName,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
    } = body;

    // Validate required fields
    if (!productPath || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: productPath, email, firstName, lastName' },
        { status: 400 }
      );
    }

    const username = process.env.FASTSPRING_USERNAME;
    const password = process.env.FASTSPRING_PASSWORD;
    const storefront = process.env.FASTSPRING_STOREFRONT;
    const returnUrl = process.env.NEXT_PUBLIC_FASTSPRING_RETURN_URL || '/payment-success';

    if (!username || !password || !storefront) {
      return NextResponse.json(
        { error: 'FastSpring credentials not configured in environment variables' },
        { status: 500 }
      );
    }

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    // Build the cart item — optionally override the catalog price
    const cartItem: Record<string, any> = {
      product: productPath,
      quantity,
    };

    // If admin set a custom price, override the catalog price for this session
    if (amountUSD && amountUSD > 0) {
      cartItem.pricing = {
        price: {
          USD: amountUSD,
        },
      };
    }

    // Build FastSpring Session API v2 payload
    const sessionPayload = {
      storefront,
      language: 'en',
      country: country || 'US',
      currency: 'USD',
      // Pre-fill customer contact info
      contact: {
        firstName,
        lastName,
        email,
        company: companyName || '',
        phoneNumber: phone || '',
        subscribeToNewsletter: false,
      },
      // Pre-fill billing address
      ...(address && {
        address: {
          addressLine1: address,
          city: city || '',
          region: state || '',
          postalCode: zipCode || '',
          country: country || 'US',
        },
      }),
      // Cart items with optional price override
      items: [cartItem],
      // Where FastSpring redirects after payment
      checkout: {
        redirectAfterCheckout: returnUrl,
      },
      tags: {
        source: 'payment-link-site',
      },
    };

    const response = await fetch(FASTSPRING_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(sessionPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[FastSpring] Session creation failed:', errorBody);
      return NextResponse.json(
        { error: 'FastSpring session creation failed', details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[FastSpring] Session created:', data?.id, '| amount override:', amountUSD ?? 'catalog price');

    const sessionId = data?.id;
    const checkoutUrl = `https://${storefront}/session/${sessionId}`;

    return NextResponse.json({ checkoutUrl, sessionId });
  } catch (err: any) {
    console.error('[FastSpring] API Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
