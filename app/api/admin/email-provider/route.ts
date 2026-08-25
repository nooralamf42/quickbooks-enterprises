import { NextRequest, NextResponse } from 'next/server';
import { getActiveEmailProvider, setActiveEmailProvider } from '@/app/lib/emailProviderSettings';

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization');
  const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
  return !!authHeader && authHeader === `Bearer ${expectedPass}`;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }
  const provider = await getActiveEmailProvider();
  return NextResponse.json({ provider });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }
  const { provider } = await req.json();
  if (provider !== 'postmark' && provider !== 'smtp2go') {
    return NextResponse.json({ error: 'provider must be "postmark" or "smtp2go"' }, { status: 400 });
  }
  await setActiveEmailProvider(provider);
  return NextResponse.json({ success: true, provider });
}
