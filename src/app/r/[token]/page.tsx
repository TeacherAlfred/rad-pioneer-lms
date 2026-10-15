import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { MessageCircle } from 'lucide-react';
import ReportCard from '@/components/reports/ReportCard';
import DownloadPdfButton from '@/components/reports/DownloadPdfButton';
import { formatIssued } from '@/lib/reports/generate';
import { guardianReports, logEvent, resolveLink } from '@/lib/reports/server';
import { RAD_WHATSAPP_NUMBER } from '@/lib/reports/types';
import s from '@/components/reports/ReportCard.module.css';

// Parent view: a private link from WhatsApp, no login. The token is hashed
// and checked against report_links (not expired, not revoked); only
// published revisions of reports for the linked child are ever loaded.
// Everything happens server-side with the service role - the browser never
// queries a table.

export const metadata: Metadata = {
  title: 'Progress report',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

function clientIp(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || h.get('x-real-ip');
}

function Expired({ reason }: { reason: 'expired' | 'revoked' | 'not_found' | 'rate_limited' }) {
  const text = encodeURIComponent('Hi RAD, my report link has expired. Please could you send me a new one?');
  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <div className={s.notice}>
          <span className={s.mono} style={{ color: 'var(--muted)' }}>RAD Academy · Progress report</span>
          <h1>{reason === 'rate_limited' ? 'Please try again later' : 'This link has expired'}</h1>
          <p>
            {reason === 'rate_limited'
              ? 'There have been too many attempts from this connection. Wait a few minutes and open the link again.'
              : 'Report links stay private by expiring after a while. Send us a WhatsApp message and we will send you a fresh link to your child’s report.'}
          </p>
          <a className={s.btn} href={`https://wa.me/${RAD_WHATSAPP_NUMBER}?text=${text}`}>
            <MessageCircle size={18} /> Ask for a new link on WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

export default async function ParentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const { report: requested } = await searchParams;
  const h = await headers();
  const link = await resolveLink(token, clientIp(h), h.get('user-agent'));
  if (!link.ok) return <Expired reason={link.reason} />;

  const reports = await guardianReports(link);
  const wantedId = typeof requested === 'string' ? requested : link.reportId;
  const shown = reports.find(r => r.reportId === wantedId) ?? reports.find(r => r.reportId === link.reportId);
  if (!shown) return <Expired reason="not_found" />;

  after(() => logEvent({
    reportId: shown.reportId, linkId: link.linkId, event: 'viewed', actorType: 'guardian', actorId: link.guardianLeadId,
    meta: { revision_id: shown.revision.id, via_report: link.reportId },
  }));

  const pdfHref = `/r/${encodeURIComponent(token)}/pdf${shown.reportId === link.reportId ? '' : `?report=${shown.reportId}`}`;

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        <ReportCard content={shown.revision.content} />
        <DownloadPdfButton href={pdfHref} />
        {reports.length > 1 && (
          <nav className={s.earlier} aria-label={`${shown.revision.content.learner.first_name}'s reports`}>
            <span className={s.mono}>{shown.revision.content.learner.first_name}&apos;s reports</span>
            <ul>
              {reports.map(r => (
                <li key={r.reportId}>
                  {r.reportId === shown.reportId ? (
                    <span aria-current="page" className={s.current}>
                      <span>{r.revision.content.programme.name} · {r.revision.content.period_label}</span>
                      <span>{formatIssued(r.revision.content.issued_on)} · showing</span>
                    </span>
                  ) : (
                    <a href={`/r/${encodeURIComponent(token)}${r.reportId === link.reportId ? '' : `?report=${r.reportId}`}`}>
                      <span>{r.revision.content.programme.name} · {r.revision.content.period_label}</span>
                      <span>{formatIssued(r.revision.content.issued_on)}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}
        <p className={s.small}>This report is private to your family. Please don&apos;t forward the link.</p>
      </div>
    </main>
  );
}
