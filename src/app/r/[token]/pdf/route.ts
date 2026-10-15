import { NextResponse } from 'next/server';
import { guardianReports, logEvent, resolveLink } from '@/lib/reports/server';
import { pdfFilename } from '@/lib/reports/generate';

// PDF download for the parent page. Same access rule as the page itself:
// a valid link, and only a published revision of a report for that child.
export const maxDuration = 60;

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || req.headers.get('x-real-ip');
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await resolveLink(token, clientIp(req), req.headers.get('user-agent'));
  if (!link.ok) return NextResponse.json({ error: 'This link has expired.' }, { status: 404 });

  const requested = new URL(req.url).searchParams.get('report') ?? link.reportId;
  const reports = await guardianReports(link);
  const shown = reports.find(r => r.reportId === requested);
  if (!shown) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });

  try {
    const { ensurePdf } = await import('@/lib/reports/pdf');
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const pdf = await ensurePdf(shown.revision.id, baseUrl);
    await logEvent({
      reportId: shown.reportId, linkId: link.linkId, event: 'downloaded', actorType: 'guardian', actorId: link.guardianLeadId,
      meta: { revision_id: shown.revision.id },
    });
    const filename = pdfFilename(shown.revision.content.learner.first_name, shown.revision.content.period_label);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('report pdf', e);
    return NextResponse.json({ error: 'The PDF could not be prepared. Please try again.' }, { status: 500 });
  }
}
