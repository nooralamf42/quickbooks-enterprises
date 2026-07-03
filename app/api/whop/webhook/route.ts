import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Whop webhooks typically have an 'action' or 'type' field indicating the event
    const action = body.action || body.type || body.event;

    console.log(`[Whop Webhook] Received event: ${action}`);

    // If it's a successful payment or membership went valid
    if (
      action === 'payment.succeeded' ||
      action === 'payment_succeeded' ||
      action === 'membership.went_valid' ||
      action === 'checkout_session.completed' ||
      action === 'payment_intent.succeeded'
    ) {
      const data = body.data || body;
      
      // We stored localOrderId in metadata when creating the checkout configuration
      const metadata = data.metadata || {};
      const localOrderId = metadata.localOrderId;

      if (localOrderId) {
        console.log(`[Whop Webhook] Updating order ${localOrderId} to Completed`);
        const { db } = await connectToDatabase();
        
        await db.collection('admindata').updateOne(
          { _id: new ObjectId(localOrderId) },
          { 
            $set: { 
              status: 'Completed', 
              paidAt: new Date(), 
              whopSessionId: data.id || '',
              updatedAt: new Date()
            } 
          }
        );
      } else {
        console.log('[Whop Webhook] No localOrderId found in metadata');
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Whop Webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
