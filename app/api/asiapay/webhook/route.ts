import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    // Extract parameters sent by AsiaPay Data Feed
    const src = formData.get('src') as string || '';
    const prc = formData.get('prc') as string || '';
    const successcode = formData.get('successcode') as string || '';
    const Ref = formData.get('Ref') as string || '';
    const PayRef = formData.get('PayRef') as string || '';
    const Cur = formData.get('Cur') as string || '';
    const Amt = formData.get('Amt') as string || '';
    const payerAuth = formData.get('payerAuth') as string || '';
    const secureHash = formData.get('secureHash') as string || '';

    const secureHashSecret = process.env.ASIAPAY_HASH_SECRET;

    if (!secureHashSecret) {
      console.error('AsiaPay webhook error: ASIAPAY_HASH_SECRET is missing');
      return new NextResponse('OK', { status: 200 }); // Return OK to stop AsiaPay from retrying
    }

    // Compute signature to verify authenticity
    // Format: src|prc|successcode|Ref|PayRef|Cur|Amt|payerAuth|secureHashSecret
    const rawHashString = `${src}|${prc}|${successcode}|${Ref}|${PayRef}|${Cur}|${Amt}|${payerAuth}|${secureHashSecret}`;
    const generatedHash = crypto.createHash('sha1').update(rawHashString).digest('hex');

    if (generatedHash !== secureHash) {
      console.error(`AsiaPay Webhook Signature Mismatch. Expected: ${generatedHash}, Received: ${secureHash}`);
      return new NextResponse('OK', { status: 200 });
    }

    // successcode = '0' means payment success
    if (successcode === '0') {
      const { db } = await connectToDatabase();
      
      try {
        await db.collection('admindata').updateOne(
          { _id: new ObjectId(Ref) },
          { 
            $set: { 
              status: 'Paid',
              paymentRef: PayRef,
              updatedAt: new Date()
            } 
          }
        );
        console.log(`AsiaPay Payment verified and updated for order: ${Ref}`);
      } catch (dbErr) {
        console.error('Error updating DB for AsiaPay webhook:', dbErr);
      }
    } else {
      console.log(`AsiaPay Payment failed or cancelled for order: ${Ref}. SuccessCode: ${successcode}`);
    }

    // Always return OK with status 200 so AsiaPay knows the feed was received
    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('AsiaPay Webhook Error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
