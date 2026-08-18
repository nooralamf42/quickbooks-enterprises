import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const logs = await db.collection('emailLogs')
      .find({})
      .sort({ sentAt: -1 })
      .limit(500)
      .toArray();

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('[Email Logs] Error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}
