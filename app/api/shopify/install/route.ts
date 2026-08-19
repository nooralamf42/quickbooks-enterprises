import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthorizeUrl } from '@/app/lib/shopify';

export async function GET(req: NextRequest) {
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${req.nextUrl.origin}/api/shopify/oauth/callback`;

  const res = NextResponse.redirect(getAuthorizeUrl(redirectUri, state));
  res.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });
  return res;
}
