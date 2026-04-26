const TRUSTAP_API_URL = "https://dev.trustap.com/api/v1/p2p/charge";
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { price } = await req.json();

    if (!price) {
      return NextResponse.json(
        { error: "Missing 'price' in request body" },
        { status: 400 }
      );
    }

    const api_key = process.env.TRUSTAP_API_KEY;

    if (!api_key) {
      return NextResponse.json(
        { error: "Missing TRUSTAP_API_KEY in environment variables" },
        { status: 500 }
      );
    }

    const response = await fetch(`${TRUSTAP_API_URL}?price=${price}&currency=usd`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${api_key}:`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text(); // or .json() if API always returns JSON
      return NextResponse.json(
        { error: "Failed to fetch from Trustap", details: errorBody },
        { status: response.status }
      );
    }
    const data = await response.json();
    console.log(data)
    return NextResponse.json(data);

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
