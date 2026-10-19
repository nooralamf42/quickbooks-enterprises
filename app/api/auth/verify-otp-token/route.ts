import { NextRequest, NextResponse } from 'next/server';

/** Validates the access-token the MSG91 OTP widget hands back client-side after a customer
 *  verifies the code sent to their email, during the /auth payment-link login. The widget's
 *  own verifyOtp() callback can't be trusted on its own — a client can call it with anything —
 *  so the token is re-checked here against MSG91's own verifyAccessToken API before the login
 *  is treated as real. */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, email } = await req.json();
    if (!accessToken || !email) {
      return NextResponse.json({ error: 'accessToken and email are required' }, { status: 400 });
    }

    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      return NextResponse.json({ error: 'MSG91_AUTH_KEY not configured' }, { status: 500 });
    }

    const res = await fetch('https://api.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: { authkey: authKey, 'content-type': 'application/json' },
      body: JSON.stringify({ 'access-token': accessToken }),
    });
    const json = await res.json().catch(() => ({}));

    // MSG91 can return HTTP 200 with an error payload (type: 'error', code: 201) — the HTTP
    // status alone doesn't say whether the token was actually valid.
    if (!res.ok || json?.type !== 'success' || json?.code === 201) {
      return NextResponse.json({ error: json?.message || 'OTP verification failed' }, { status: 401 });
    }

    // On success `message` is the identifier (email) the token was actually issued for —
    // confirm it matches what the client claims rather than trusting the claim alone.
    const verifiedIdentifier = String(json.message || '').trim().toLowerCase();
    if (verifiedIdentifier !== String(email).trim().toLowerCase()) {
      return NextResponse.json({ error: 'Verified identifier does not match the email on file' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Verify OTP Token] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
