import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amountUSD, paymentMethodId, email, firstName, lastName, planDetails, localOrderId } = body;

    const apiKey = process.env.STAX_API_KEY;
    const apiUrl = 'https://apiprod.fattlabs.com';

    if (!apiKey) {
      return NextResponse.json({ error: 'Stax API key is not configured' }, { status: 500 });
    }

    if (!amountUSD || !paymentMethodId) {
      return NextResponse.json({ error: 'Amount and Payment Method ID are required' }, { status: 400 });
    }

    const staxResponse = await fetch(`${apiUrl}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        total: amountUSD,
        payment_method_id: paymentMethodId,
        pre_auth: false,
        meta: {
          customer_email: email,
          customer_name: `${firstName} ${lastName}`.trim(),
          memo: planDetails || 'QuickBooks Enterprise Subscription',
        },
      }),
    });

    if (!staxResponse.ok) {
      const errorText = await staxResponse.text();
      console.error('[Stax] Charge error:', errorText);

      let errorMessage = 'Failed to process payment';
      try {
        const j = JSON.parse(errorText);
        // Stax returns errors as { message } or gateway response strings
        errorMessage = j.message || (typeof j === 'string' ? j : errorMessage);
        // Gateway decline messages come back as "gateway response: ..."
        if (j.payment_attempt_message) errorMessage = j.payment_attempt_message;
      } catch (_) {}

      // Mark the pending record as Failed if we have it
      if (localOrderId) {
        try {
          const { db } = await connectToDatabase();
          await db.collection('admindata').updateOne(
            { _id: new ObjectId(localOrderId) },
            { $set: { status: 'Failed', updatedAt: new Date() } }
          );
        } catch (_) {}
      }

      return NextResponse.json({ error: `gateway response: ${errorMessage}` }, { status: staxResponse.status });
    }

    const staxData = await staxResponse.json();
    console.log('[Stax] Charge successful:', staxData.id);

    // Update MongoDB record to Completed
    if (localOrderId) {
      try {
        const { db } = await connectToDatabase();
        const record = await db.collection('admindata').findOneAndUpdate(
          { _id: new ObjectId(localOrderId) },
          {
            $set: {
              status: 'Completed',
              fsOrderId: staxData.id,
              fsOrderReference: `STAX-${staxData.id}`,
              paidAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'before' }
        );

        // Send notification email to the business
        if (process.env.RESEND_API_KEY && record) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const customerName = `${record.firstName} ${record.lastName}`.trim();

            await resend.emails.send({
              from: 'notifications@quickbooks-enterprises.com',
              to: 'info@qualitybusinesstech.us',
              subject: `New Successful Payment: $${record.amountUSD} from ${customerName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
                  <h2 style="color:#2ca01c;">New Successful Payment (Stax)</h2>
                  <table style="width:100%;border-collapse:collapse;margin-top:20px;">
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Customer Name:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${customerName}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Email:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.email}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Phone:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.phone || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Company:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.companyName || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Billing Address:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.address}<br>${record.city}, ${record.state} ${record.zipCode}<br>${record.country}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Plan:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.planDetails}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Amount Paid:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#2ca01c;">$${record.amountUSD} USD</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Transaction ID:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${staxData.id}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>IP Address:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.ipAddress || 'Unknown'}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;"><strong>Device/Browser:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;">${record.deviceType || 'Unknown'} — ${record.browser || 'Unknown'}</td></tr>
                  </table>
                  <p style="margin-top:30px;font-size:12px;color:#888;">Automatically generated by your QuickBooks Enterprise payment portal.</p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error('[Stax charge] Email error:', emailErr);
          }
        }
      } catch (dbErr) {
        console.error('[Stax charge] DB update error:', dbErr);
      }
    }

    return NextResponse.json({ success: true, transactionId: staxData.id });
  } catch (error: any) {
    console.error('[Stax API Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
