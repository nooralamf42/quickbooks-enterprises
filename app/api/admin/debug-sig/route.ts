import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    const logs = await db
      .collection('admindata')
      .find({})
      .sort({ agreedTimestamp: -1 })
      .limit(1)
      .toArray();

    if (logs.length > 0) {
      const log = logs[0];
      return NextResponse.json({
        id: log._id,
        firstName: log.firstName,
        lastName: log.lastName,
        hasSignature: !!log.clientSignatureBase64,
        signatureLength: log.clientSignatureBase64 ? log.clientSignatureBase64.length : 0,
        signaturePrefix: log.clientSignatureBase64 ? log.clientSignatureBase64.substring(0, 30) : null
      });
    }

    return NextResponse.json({ error: 'No logs found' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
