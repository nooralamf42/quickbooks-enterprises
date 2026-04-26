// app/api/create-guest-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = 'https://dev.trustap.com/api/v1/guest_users';
const API_KEY = process.env.TRUSTAP_API_KEY as string;
export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.replaceAll('::ffff:', '') || '0.0.0.0';
  const { email, first_name, last_name } = await req.json();
  const unixTimeInSeconds = Math.floor(Date.now() / 1000);
  const payload = `{
    "email":"${email}",
    "first_name":"${first_name}",
    "last_name":"${last_name}",
    "country_code" : "us",
    "tos_acceptance": {
      "unix_timestamp": ${unixTimeInSeconds},"ip":"${clientIp}"
    }
  }`

  try {
    const response = await axios.post(API_URL, (payload), {
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: API_KEY,
        password: '',
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    // console.log(error)
    console.error('Trustap API Error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        message: 'Failed to create guest user',
        error: error.response?.data || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }

}
