import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ensureEmailLogIndexes } from '@/app/lib/emailLog';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Escapes regex metacharacters so a search term is matched literally — without this, an
 *  email like "a.b+c@x.com" would be interpreted as a pattern instead of literal text, and
 *  unescaped input handed to $regex is also a denial-of-service vector. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    void ensureEmailLogIndexes(); // fire-and-forget; createIndex is idempotent

    const { searchParams } = req.nextUrl;
    const q = (searchParams.get('q') || '').trim();
    const trigger = (searchParams.get('trigger') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

    const filter: Record<string, unknown> = {};
    if (q) filter.toEmail = { $regex: escapeRegex(q), $options: 'i' };
    if (trigger) filter.trigger = trigger;

    const collection = db.collection('emailLogs');
    const [logs, total] = await Promise.all([
      collection.find(filter).sort({ sentAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (err: any) {
    console.error('[Email Logs] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
