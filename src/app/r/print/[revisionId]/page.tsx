import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReportCard from '@/components/reports/ReportCard';
import { getRevision, verifyPrint } from '@/lib/reports/server';

// What headless Chrome captures for the stored PDF (src/lib/reports/pdf.ts).
// Only reachable with a short-lived HMAC signature minted server-side, and
// only for a revision that has been published - drafts never print.

export const metadata: Metadata = {
  title: 'Progress report',
  robots: { index: false, follow: false },
};

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ revisionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { revisionId } = await params;
  const { sig } = await searchParams;
  if (typeof sig !== 'string' || !verifyPrint(revisionId, sig)) notFound();
  const rev = await getRevision(revisionId);
  if (!rev || !rev.published_at) notFound();
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* The root layout paints body dark; Chrome carries that into the PDF margins. */}
      <style>{'html, body { background: #fff !important; }'}</style>
      <ReportCard content={rev.content} mode="print" />
    </div>
  );
}
