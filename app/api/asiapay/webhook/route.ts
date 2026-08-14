import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const textData = await req.text();
    const params = new URLSearchParams(textData);
    
    // Extract parameters sent by AsiaPay Data Feed
    const src = params.get('src') || '';
    const prc = params.get('prc') || '';
    const successcode = params.get('successcode') || '';
    const Ref = params.get('Ref') || '';
    const PayRef = params.get('PayRef') || '';
    const Cur = params.get('Cur') || '';
    const Amt = params.get('Amt') || '';
    const payerAuth = params.get('payerAuth') || '';
    const secureHash = params.get('secureHash') || '';
    // Optional card-brand/masked-PAN fields — only present if enabled on the
    // AsiaPay merchant account's Data Feed configuration.
    const pMethod = params.get('pMethod') || '';
    const panLast4 = params.get('panLast4') || '';

    const { db } = await connectToDatabase();
    const secureHashSecret = process.env.ASIAPAY_HASH_SECRET;

    // 1. Log the incoming webhook to the database for debugging
    await db.collection('webhook_logs').insertOne({
      timestamp: new Date(),
      payload: textData,
      extracted: { src, prc, successcode, Ref, PayRef, Cur, Amt, payerAuth, secureHash },
      hasSecret: !!secureHashSecret
    });

    if (!secureHashSecret) {
      console.error('AsiaPay webhook error: ASIAPAY_HASH_SECRET is missing');
      return new NextResponse('OK', { status: 200 }); // Return OK to stop AsiaPay from retrying
    }

    // Compute signature to verify authenticity
    const rawHashString = `${src}|${prc}|${successcode}|${Ref}|${PayRef}|${Cur}|${Amt}|${payerAuth}|${secureHashSecret}`;
    const generatedHash = crypto.createHash('sha1').update(rawHashString).digest('hex');

    if (generatedHash !== secureHash) {
      console.error(`AsiaPay Webhook Signature Mismatch. Expected: ${generatedHash}, Received: ${secureHash}`);
      await db.collection('webhook_logs').insertOne({
        timestamp: new Date(),
        error: "Signature Mismatch",
        expected: generatedHash,
        received: secureHash,
        rawHashString
      });
      return new NextResponse('OK', { status: 200 });
    }

    // successcode = '0' means payment success
    if (successcode === '0') {
      try {
        const paymentMethodLabel = panLast4
          ? `${pMethod || 'Card'} ending in ${panLast4}`
          : 'Card on file';

        await db.collection('admindata').updateOne(
          { _id: new ObjectId(Ref) },
          {
            $set: {
              status: 'Completed',
              paymentRef: PayRef,
              cardType: pMethod || undefined,
              cardLast4: panLast4 || undefined,
              paymentMethodLabel,
              updatedAt: new Date()
            }
          }
        );
        console.log(`AsiaPay Payment verified and updated for order: ${Ref}`);
      } catch (dbErr) {
        console.error('Error updating DB for AsiaPay webhook:', dbErr);
        await db.collection('webhook_logs').insertOne({ error: "DB Update Error", details: String(dbErr) });
      }
    }

    // Always return OK with status 200 so AsiaPay knows the feed was received
    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('AsiaPay Webhook Error:', error);
    try {
      const { db } = await connectToDatabase();
      await db.collection('webhook_logs').insertOne({ error: "Fatal Error", details: String(error) });
    } catch(e) {}
    return new NextResponse('OK', { status: 200 });
  }
}
