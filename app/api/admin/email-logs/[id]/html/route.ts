import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
import { MAIL2_ID_PREFIX, stripPostalTrackingPixel } from '@/app/lib/postal';
import { reconstructEmailHtml } from '@/app/lib/emailReconstruct';

/** Returns the email behind one Email Logs row, for the PDF's first page.
 *  `source` says how trustworthy it is:
 *   - stored         the exact HTML saved when the email was sent
 *   - postal         fetched from the Postal server that sent it, then saved on the row
 *   - reconstructed  rebuilt from the row's saved details (emails sent before HTML was stored,
 *                    and itWALK rows — itWALK's logs only cover 48h and carry no body)
 *  Rows with nothing to show return html: null. */

/** Only trusts a Postal answer for the same recipient and subject as the log row. Message ids are
 *  per-server counters, so asking the wrong server (e.g. an env still pointing at the older one)
 *  would otherwise return some unrelated email under this row. */
async function fetchFromPostal(row: Record<string, any>): Promise<string | null> {
  const providerMessageId: string = row.providerMessageId;
  if (!providerMessageId.startsWith(MAIL2_ID_PREFIX)) return null;
  const apiKey = process.env.POSTAL_API_KEY;
  const sendUrl = process.env.POSTAL_API_URL || 'https://mail2.quickbooks-enterprises.com/api/v1/send/message';
  if (!apiKey || !sendUrl.includes('//mail2.')) return null;

  const messageId = Number(providerMessageId.slice(MAIL2_ID_PREFIX.length));
  if (!Number.isInteger(messageId)) return null;

  try {
    const res = await fetch(sendUrl.replace(/\/send\/message$/, '/messages/message'), {
      method: 'POST',
      headers: { 'X-Server-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, _expansions: ['details', 'html_body'] }),
    });
    const json = await res.json().catch(() => ({}));
    const data = json?.data;
    const html = data?.html_body;
    if (json?.status !== 'success' || typeof html !== 'string' || !html) return null;
    const details = data?.details;
    if (String(details?.rcpt_to || '').toLowerCase() !== String(row.toEmail || '').toLowerCase()) return null;
    if (details?.subject && row.subject && details.subject !== row.subject) return null;
    return stripPostalTrackingPixel(html);
  } catch (err) {
    console.error('[Email Log HTML] Postal fetch failed:', err);
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid log id' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('emailLogs');
    const row = await collection.findOne({ _id: new ObjectId(id) });
    if (!row) {
      return NextResponse.json({ error: 'Log row not found' }, { status: 404 });
    }

    if (typeof row.html === 'string' && row.html) {
      // Stripped again on the way out: the iframe fetches any <img> as soon as it loads, so a
      // tracking pixel left in a stored copy would still count as an open every time a PDF is made.
      return NextResponse.json({ html: stripPostalTrackingPixel(row.html), source: 'stored' });
    }

    if (row.provider === 'postal' && typeof row.providerMessageId === 'string') {
      const html = await fetchFromPostal(row);
      if (html) {
        await collection.updateOne({ _id: row._id }, { $set: { html } });
        return NextResponse.json({ html, source: 'postal' });
      }
    }

    const html = await reconstructEmailHtml(row);
    return NextResponse.json({ html, source: html ? 'reconstructed' : null });
  } catch (err: any) {
    console.error('[Email Log HTML] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
