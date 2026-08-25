import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

// Renders the exact same /quote-v2/[id] page (in ?print=1 mode, which just
// hides the interactive Accept/Request-a-change chrome) to PDF - one
// template for web and PDF, per spec §10, rather than a second document
// definition that could drift from the live page.
//
// puppeteer-core ships no browser of its own. On Vercel/serverless,
// @sparticuz/chromium-min fetches a matching prebuilt Chromium from
// CHROMIUM_PACK_URL (defaults to the pack matching the installed
// @sparticuz/chromium-min version - update both together). Locally, point
// PUPPETEER_EXECUTABLE_PATH at a real Chrome/Chromium install; there's no
// bundled fallback (see the deployment note in the build report).
// Sparticuz's release assets are arch-suffixed (chromium-v149.0.0-pack.x64.tar,
// not chromium-v149.0.0-pack.tar) - the un-suffixed name 404s, which is what
// was actually breaking every PDF request in production.
const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const isLocal = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERSION;
  if (isLocal && !localExecutablePath) {
    return NextResponse.json(
      { error: 'PDF rendering needs PUPPETEER_EXECUTABLE_PATH set to a local Chrome/Chromium install for local dev (Vercel deploys resolve Chromium automatically via @sparticuz/chromium-min).' },
      { status: 500 }
    );
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: isLocal ? localExecutablePath! : await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/quote-v2/${id}?print=1`, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quote-${id}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
