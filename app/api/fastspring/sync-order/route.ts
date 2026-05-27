import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const { reference } = await req.json();
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const username = process.env.FASTSPRING_USERNAME;
    const password = process.env.FASTSPRING_PASSWORD;

    if (!username || !password) {
      return NextResponse.json({ error: 'FastSpring credentials missing' }, { status: 500 });
    }

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Fetch from FastSpring API
    const fsResponse = await fetch(`https://api.fastspring.com/orders/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    });

    if (!fsResponse.ok) {
      return NextResponse.json({ error: 'Order not found in FastSpring' }, { status: 404 });
    }

    const orderData = await fsResponse.json();
    
    // Verify FastSpring actually marks this as a completed order
    if (orderData.completed !== true) {
      return NextResponse.json({ status: 'pending', message: 'Order not yet completed in FastSpring' });
    }

    const tags = orderData.tags || {};
    const localOrderId = tags.localOrderId;

    const { db } = await connectToDatabase();
    
    // 1. If we have a localOrderId, try to update the existing Pending record
    if (localOrderId) {
      try {
        const existingRecord = await db.collection('admindata').findOne({ _id: new ObjectId(localOrderId) });
        
        if (existingRecord) {
          if (existingRecord.status === 'Completed') {
            return NextResponse.json({ status: 'already_synced' });
          }

          await db.collection('admindata').updateOne(
            { _id: new ObjectId(localOrderId) },
            {
              $set: {
                status: 'Completed',
                fsOrderReference: orderData.reference,
                fsOrderId: orderData.id,
                paidAt: new Date(),
                amountUSD: parseFloat(orderData.total || existingRecord.amountUSD),
              }
            }
          );
          return NextResponse.json({ status: 'synced', localOrderId });
        }
      } catch (e) {
        console.warn('[Sync Order] localOrderId was invalid or not found, falling back to insert');
      }
    }

    // 2. Fallback: If pending record is missing or localOrderId wasn't saved, insert a new record directly from tags
    // Check if we already synced this order reference to avoid duplicates
    const existingRef = await db.collection('admindata').findOne({ fsOrderReference: orderData.reference });
    if (existingRef) {
      return NextResponse.json({ status: 'already_synced' });
    }

    const newRecord = {
      email: tags.email || orderData?.customer?.email || '',
      firstName: tags.firstName || orderData?.customer?.firstName || '',
      lastName: tags.lastName || orderData?.customer?.lastName || '',
      companyName: tags.companyName || orderData?.customer?.company || '',
      phone: tags.phone || orderData?.customer?.phone || '',
      address: tags.address || orderData?.customer?.address?.addressLine1 || '',
      city: tags.city || orderData?.customer?.address?.city || '',
      state: tags.state || orderData?.customer?.address?.region || '',
      zipCode: tags.zipCode || orderData?.customer?.address?.postalCode || '',
      country: tags.country || orderData?.customer?.address?.country || 'US',
      ipAddress: tags.ipAddress || orderData?.ip || '127.0.0.1',
      browser: tags.browser || 'Unknown',
      deviceType: tags.deviceType || 'Desktop',
      amountUSD: parseFloat(tags.amountUSD || orderData?.total || '0'),
      planDetails: tags.planDetails || `QuickBooks Enterprise (Order Ref: ${orderData?.reference})`,
      agreedToTerms: tags.agreedToTerms === 'true' || true,
      agreedTimestamp: tags.agreedTimestamp ? new Date(tags.agreedTimestamp) : new Date(),
      status: 'Completed',
      fsOrderReference: orderData.reference || '',
      fsOrderId: orderData.id || '',
      paidAt: new Date(),
      createdAt: new Date(),
    };
    
    await db.collection('admindata').insertOne(newRecord);
    return NextResponse.json({ status: 'recreated_and_synced' });

  } catch (error: any) {
    console.error('[Sync Order Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
