import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

const FASTSPRING_API_URL = 'https://api.fastspring.com/sessions';

function parseUserAgent(ua: string | null) {
  if (!ua) return { browser: 'Unknown', device: 'Desktop' };
  
  let device = 'Desktop';
  if (/mobi|android|iphone|ipad|ipod/i.test(ua)) {
    device = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  let browser = 'Unknown';
  if (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/safari/i.test(ua) && !/chrome|crios|edge|edg|opr/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/edge|edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/opr/i.test(ua)) {
    browser = 'Opera';
  } else if (/trident|msie/i.test(ua)) {
    browser = 'Internet Explorer';
  }
  
  return { browser, device };
}

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
      agreedToTerms,
    } = body;

    // Validate required fields
    if (!productPath || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: productPath, email, firstName, lastName' },
        { status: 400 }
      );
    }

    // Capture IP Address
    let ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim();
    }

    // Capture User Agent & Parse Browser / Device
    const userAgentStr = req.headers.get('user-agent');
    const { browser, device } = parseUserAgent(userAgentStr);



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
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        companyName: companyName || '',
        phone: phone || '',
        address: address || '',
        city: city || '',
        state: state || '',
        zipCode: zipCode || '',
        country: country || 'US',
        ipAddress: ipAddress,
        browser: browser,
        deviceType: device,
        amountUSD: amountUSD ? amountUSD.toString() : '0',
        planDetails: `QuickBooks Enterprise 24.0 (Edition: ${productPath.toUpperCase()}, Override Price: $${amountUSD || 'Catalog'})`,
        agreedToTerms: agreedToTerms || 'true',
        agreedTimestamp: new Date().toISOString(),
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
