import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    // Admin password authorization check
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const logs = await db
      .collection('admindata')
      .find({})
      .sort({ agreedTimestamp: -1 })
      .toArray();

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('[API ConsentLogs] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
