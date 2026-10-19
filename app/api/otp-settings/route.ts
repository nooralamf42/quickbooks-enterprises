import { NextRequest, NextResponse } from 'next/server';
import { isOtpStepEnabled, setOtpStepEnabled } from '@/app/lib/otpSettings';

// GET is intentionally unauthenticated — the customer-facing /auth page needs to read this
// before deciding whether to show the OTP step at all, and whether the step is on or off isn't
// sensitive. Only flipping it (POST) requires the admin password.
export async function GET() {
  const enabled = await isOtpStepEnabled();
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const expectedPass = process.env.NEXT_PUBLIC_ENCODED_ADMIN_PASSWORD;
  if (!authHeader || authHeader !== `Bearer ${expectedPass}`) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }
  const { enabled } = await req.json();
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }
  await setOtpStepEnabled(enabled);
  return NextResponse.json({ success: true, enabled });
}
