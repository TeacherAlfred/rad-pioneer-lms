import 'server-only';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

// Headless Chrome capture of a report print page, shared by the stored
// parent PDF (pdf.ts, published revisions) and the staff draft preview
// (draft-pdf route). Kept free of R2 so the draft path works without
// storage credentials.
//
// Locally, set PUPPETEER_EXECUTABLE_PATH to a Chrome install (see the quote
// PDF route); on Vercel Chromium comes from CHROMIUM_PACK_URL.
const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

function footer(left: string) {
  return `
  <div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#566A6F;padding:0 18mm;display:flex;justify-content:space-between;">
    <span>${left}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

export async function renderPrintPage(url: string, opts: { draft?: boolean } = {}): Promise<Buffer> {
  const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const isLocal = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERSION;
  if (isLocal && !localExecutablePath) {
    throw new Error('PDF rendering needs PUPPETEER_EXECUTABLE_PATH set to a local Chrome/Chromium install for local dev.');
  }
  const browser = await puppeteer.launch({
    // Sparticuz's flags are tuned for Lambda's Chromium and stop desktop
    // Chrome launching (Windows), so they're only used when deployed.
    args: isLocal ? [] : chromium.args,
    executablePath: isLocal ? localExecutablePath! : await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(url, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer(opts.draft
        ? 'DRAFT · not the final report · do not send to parents'
        : 'RAD Academy · Turning players into developers'),
      margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
