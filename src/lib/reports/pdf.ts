import 'server-only';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, BUCKET_NAME } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRevision, signPrint } from './server';
import { renderPrintPage } from './pdfRender';

// The parent PDF is the /r/print/<revisionId> page (the same ReportCard
// renderer the parent sees, in print layout) captured by headless Chrome -
// one template for web and PDF, same approach as /api/quote-v2/[id]/pdf. It
// is stored in the private R2 bucket keyed by revision id, so the file
// always matches the published snapshot; revisions are immutable, so a
// stored PDF never goes stale.

export function pdfKey(revisionId: string) {
  return `report-cards/${revisionId}.pdf`;
}

async function renderPdf(revisionId: string, baseUrl: string): Promise<Buffer> {
  return renderPrintPage(`${baseUrl}/r/print/${revisionId}?sig=${encodeURIComponent(signPrint(revisionId))}`);
}

// Returns the stored PDF for a revision, rendering and storing it first if
// it isn't there yet (publish pre-renders it in the background; this is
// the fallback if that failed or hasn't finished).
export async function ensurePdf(revisionId: string, baseUrl: string): Promise<Buffer> {
  const rev = await getRevision(revisionId);
  if (!rev) throw new Error('Revision not found.');
  if (rev.pdf_key) {
    try {
      const obj = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: rev.pdf_key }));
      if (obj.Body) return Buffer.from(await obj.Body.transformToByteArray());
    } catch {
      // Missing in R2 - fall through and re-render.
    }
  }
  const pdf = await renderPdf(revisionId, baseUrl);
  const key = pdfKey(revisionId);
  await r2Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: pdf, ContentType: 'application/pdf' }));
  await supabaseAdmin().from('report_revisions').update({ pdf_key: key }).eq('id', revisionId);
  return pdf;
}
