import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

/** Backs the admin Surveys page. Previously that page queried MongoDB directly from a
 *  server component with no auth check at all — anyone who guessed /admin/surveys could
 *  read every customer's email and feedback. Routed through the same Bearer-token gate
 *  every other admin endpoint uses. */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const surveys = await db.collection('surveys').find().sort({ submittedAt: -1 }).toArray();

    return NextResponse.json({
      surveys: surveys.map((s) => ({
        id: s._id.toString(),
        submittedAt: s.submittedAt,
        customerName: s.customerName || '',
        customerEmail: s.customerEmail || 'unknown',
        companyName: s.companyName || '',
        ipAddress: s.ipAddress || '',
        userAgent: s.userAgent || '',
        score: s.score,
        reason: s.reason || '',
      })),
    });
  } catch (err: any) {
    console.error('[Admin Surveys] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
