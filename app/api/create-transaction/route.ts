// app/api/create-guest-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const API_URL = 'https://dev.trustap.com/api/v1/p2p/me/transactions/create_with_guest_user';
const API_KEY = process.env.TRUSTAP_API_KEY as string;
const SELLER_ID = process.env.TRUSTAP_SELLER_ID as string;
export async function POST(req: NextRequest) {

  const { buyer_id, deposit_price, deposit_charge, description } = await req.json();
  const payload = {
    "seller_id": SELLER_ID,
    "buyer_id": buyer_id,
    "creator_role": "seller",
    "currency": "usd",
    "description": description,
    "deposit_price": deposit_price,
    "deposit_charge": deposit_charge,
    "charge_calculator_version": 5,
  }

  try {
    const response = await axios.post(API_URL, (payload), {
      headers: {
        'Content-Type': 'application/json',
        'Trustap-User': SELLER_ID
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
        message: 'Failed to create transaction',
        error: error.response?.data || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }

}
