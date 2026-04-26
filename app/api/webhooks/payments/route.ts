// app/api/create-guest-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const data = await req.json();
  return NextResponse.json({message: 'success'})

}
