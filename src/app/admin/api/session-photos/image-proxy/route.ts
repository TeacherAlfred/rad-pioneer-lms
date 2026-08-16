import { NextResponse } from 'next/server';

// face-api.js needs to read raw pixel data off the image via canvas,
// which throws a SecurityError on a cross-origin image unless the
// origin serves CORS headers - the R2 API token this app holds can't
// read/set bucket CORS (AccessDenied on GetBucketCors), so instead of
// requiring a Cloudflare dashboard change, this route re-serves the
// same public R2 object from our own origin. Restricted to this app's
// own R2 public URL prefix to avoid becoming an open image proxy.
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url || !R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
    return NextResponse.json({ error: 'Invalid or disallowed url' }, { status: 400 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
