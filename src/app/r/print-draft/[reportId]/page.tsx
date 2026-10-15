import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReportCard from '@/components/reports/ReportCard';
import { getReport, verifyPrint, workingContent } from '@/lib/reports/server';

// Staff-only draft preview for headless Chrome (admin draft-pdf route).
// Reachable only with a short-lived HMAC signature scoped to "draft:<id>",
// so it can't be guessed, and it always carries the DRAFT watermark.

export const metadata: Metadata = {
  title: 'Draft report',
  robots: { index: false, follow: false },
};

export default async function DraftPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { reportId } = await params;
  const { sig } = await searchParams;
  if (typeof sig !== 'string' || !verifyPrint(`draft:${reportId}`, sig)) notFound();
  const report = await getReport(reportId);
  const content = report ? await workingContent(report) : null;
  if (!content) notFound();
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <style>{'html, body { background: #fff !important; }'}</style>
      <ReportCard content={content} mode="print" draft />
    </div>
  );
}
