import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route to fetch a Cloudinary file from the server side,
 * bypassing browser CORS restrictions when merging PDFs with pdf-lib.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    // Only allow Cloudinary URLs for security
    if (!url.startsWith('https://res.cloudinary.com/')) {
      return NextResponse.json({ error: 'Only Cloudinary URLs are allowed' }, { status: 403 });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: any) {
    console.error('[Proxy Fetch] Error:', err);
    return NextResponse.json({ error: 'Proxy fetch failed', message: err.message }, { status: 500 });
  }
}
