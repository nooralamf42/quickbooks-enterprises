import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;

    if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('admindata').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'Completed',
          paidAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mark as paid error:', error);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}
