import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { createDraftOrderInvoice } from '@/app/lib/shopify';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      amountUSD, email, firstName, lastName, phone, planDetails,
      address, city, state, zipCode, country, companyName, ein,
      clientSignatureBase64, agreedToTerms
    } = body;

    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge|opera)[\/\s][\d.]+/i);
    const browser = browserMatch ? browserMatch[0] : userAgent.substring(0, 60) || 'Unknown';

    const { db } = await connectToDatabase();

    const result = await db.collection('admindata').insertOne({
      firstName, lastName, email, phone, companyName, ein,
      address, city, state, zipCode, country,
      amountUSD, planDetails,
      status: 'Pending',
      agreedToTerms: agreedToTerms === 'true' || agreedToTerms === true,
      clientSignatureBase64,
      agreedTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentGateway: 'Shopify',
      ipAddress,
      deviceType,
      browser
    });

    const localOrderId = result.insertedId.toString();
    const customerName = `${firstName || ''} ${lastName || ''}`.trim();

    const shopifyRes = await createDraftOrderInvoice({
      title: planDetails || 'QuickBooks Enterprise',
      amountUSD: Number(amountUSD),
      customerEmail: email,
      note: customerName ? `Customer: ${customerName}` : undefined,
      localOrderId,
      billingAddress: {
        firstName,
        lastName,
        address1: address,
        city,
        provinceCode: state,
        zip: zipCode,
        countryCode: country,
        phone,
      },
    });

    if (!shopifyRes.ok || shopifyRes.data?.draftOrderCreate?.userErrors?.length) {
      console.error('[Shopify Checkout] draftOrderCreate failed:', shopifyRes.errors || shopifyRes.data?.draftOrderCreate?.userErrors);
      return NextResponse.json({ error: 'Shopify draft order creation failed' }, { status: 502 });
    }

    const draftOrder = shopifyRes.data?.draftOrderCreate?.draftOrder;
    if (!draftOrder?.invoiceUrl) {
      console.error('[Shopify Checkout] No invoice URL in response:', shopifyRes.data);
      return NextResponse.json({ error: 'Shopify did not return a checkout URL' }, { status: 502 });
    }

    await db.collection('admindata').updateOne(
      { _id: result.insertedId },
      { $set: { shopifyDraftOrderId: draftOrder.id, shopifyDraftOrderName: draftOrder.name, updatedAt: new Date() } }
    );

    return NextResponse.json({ redirectUrl: draftOrder.invoiceUrl, localOrderId });
  } catch (error: any) {
    console.error('Shopify Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
