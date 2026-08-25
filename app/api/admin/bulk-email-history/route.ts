import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

/** Looks up the most recent send of a given type for each email in a bulk batch, so the
 *  admin can see "this person already got a reminder 2 days ago" before sending another one
 *  — rather than finding out only after a customer complains about a duplicate. */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { emails, type } = (await req.json()) as { emails: string[]; type: 'reminder' | 'receipt' };
    if (type !== 'reminder' && type !== 'receipt') {
      return NextResponse.json({ error: 'type must be "reminder" or "receipt"' }, { status: 400 });
    }
    const normalized = [...new Set((emails || []).map((e) => String(e).trim()).filter(Boolean))];
    if (!normalized.length) {
      return NextResponse.json({ history: {} });
    }

    const { db } = await connectToDatabase();
    // Case-insensitive match, since a spreadsheet's casing won't always match what was
    // stored on a prior send — collation compares strings ignoring case rather than
    // requiring the caller to guess the right casing.
    const rows = await db.collection('emailLogs')
      .find({ type, toEmail: { $in: normalized } })
      .collation({ locale: 'en', strength: 2 })
      .sort({ sentAt: -1 })
      .project({ toEmail: 1, sentAt: 1 })
      .toArray();

    // Rows arrive newest-first, so the first occurrence per email is its most recent send.
    const history: Record<string, string> = {};
    for (const row of rows) {
      const key = String(row.toEmail).trim().toLowerCase();
      if (!(key in history)) history[key] = row.sentAt;
    }

    return NextResponse.json({ history });
  } catch (err: any) {
    console.error('[Bulk Email History] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
