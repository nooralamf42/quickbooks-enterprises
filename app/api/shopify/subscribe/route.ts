import { NextRequest, NextResponse } from 'next/server';
import { createSubscriptionCheckoutUrl, PAYROLL_SUBSCRIPTION_VARIANTS } from '@/app/lib/shopify';

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier') ?? '';

  if (!(tier in PAYROLL_SUBSCRIPTION_VARIANTS)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  try {
    const checkoutUrl = await createSubscriptionCheckoutUrl(tier);
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Failed to create checkout' }, { status: 502 });
    }
    return NextResponse.redirect(checkoutUrl);
  } catch (error: any) {
    console.error('[Shopify Subscribe Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
