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

/** Converts a wall-clock 'YYYY-MM-DD' + 'HH:mm:ss.SSS' in the given IANA timezone to the
 *  equivalent UTC Date. Needed because the admin table displays sentAt in America/New_York
 *  elsewhere on this page — filtering by raw UTC day boundaries would miss/include emails
 *  near midnight EST/EDT relative to what the admin sees on screen.
 *
 *  Deliberately avoids the common `toLocaleString(...)` round-trip trick: that relies on
 *  `Date` parsing a locale string back as the HOST machine's local time, which silently
 *  produces wrong offsets whenever the server's TZ isn't UTC (confirmed broken on a dev
 *  machine set to Asia/Calcutta). `Intl.DateTimeFormat.formatToParts` reads the target IANA
 *  zone's offset directly and is independent of the host's own local timezone. */
function zonedDateTimeToUtc(dateStr: string, time: string, timeZone: string): Date {
  const [wholeSecondTime, msPart] = time.split('.');
  const ms = Number((msPart ?? '000').padEnd(3, '0'));
  const baseline = new Date(`${dateStr}T${wholeSecondTime}Z`);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(baseline).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);

  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const diffMs = baseline.getTime() - asUtc;
  return new Date(baseline.getTime() + diffMs + ms);
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
    const dateFromRaw = (searchParams.get('dateFrom') || '').trim();
    const dateToRaw = (searchParams.get('dateTo') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

    const filter: Record<string, unknown> = {};
    if (q) {
      const re = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ toEmail: re }, { customerName: re }];
    }
    if (trigger) filter.trigger = trigger;

    const sentAtFilter: Record<string, Date> = {};
    if (dateFromRaw) {
      const d = zonedDateTimeToUtc(dateFromRaw, '00:00:00.000', 'America/New_York');
      if (!isNaN(d.getTime())) sentAtFilter.$gte = d;
    }
    if (dateToRaw) {
      const d = zonedDateTimeToUtc(dateToRaw, '23:59:59.999', 'America/New_York');
      if (!isNaN(d.getTime())) sentAtFilter.$lte = d;
    }
    if (Object.keys(sentAtFilter).length > 0) filter.sentAt = sentAtFilter;

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
