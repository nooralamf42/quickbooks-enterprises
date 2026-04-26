// app/api/create-guest-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// const API_URL = 'https://dev.trustap.com/api/v1/p2p/me/transactions/create_with_guest_user';
const API_KEY = process.env.TRUSTAP_API_KEY as string;
// const SELLER_ID = process.env.TRUSTAP_SELLER_ID as string;
export async function POST(req: NextRequest) {

  const { transactionId, buyer_id, description } = await req.json();
  const payload = {
    "description": description
  }

  try {
    const API_URL = `https://dev.trustap.com/api/v1/p2p/transactions/${transactionId}/complain_with_guest_buyer`;
    const response = await axios.post(API_URL, (payload), {
      headers: {
        'Content-Type': 'application/json',
        'Trustap-User': buyer_id
      },
      auth: {
        username: API_KEY,
        password: '',
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.log(error)
    console.error('Trustap API Error:', error.response?.data || error.message);
    return NextResponse.json(
      {
        message: 'Failed to create complaint',
        error: error.response?.data || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }

}
