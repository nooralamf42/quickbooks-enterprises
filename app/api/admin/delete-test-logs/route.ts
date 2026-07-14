import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    // Delete any documents where email ends with @example.com or is in the TEST_EMAILS list
    const result = await db.collection('admindata').deleteMany({
      $or: [
        { email: { $regex: /@example\.com$/i } },
        { email: { $in: ['info@qualitybusinesstech.us', 'nick.powerjobs@gmail.com', 'contact@qbenterprise.us'] } }
      ]
    });

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Delete test logs error:', error);
    return NextResponse.json({ error: 'Failed to delete test logs' }, { status: 500 });
  }
}
