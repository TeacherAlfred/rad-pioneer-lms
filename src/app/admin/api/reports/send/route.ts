import { NextResponse } from 'next/server';
import { adminEmail } from '@/lib/adminIdentity';
import { getReport, issueLinks } from '@/lib/reports/server';

// Issues fresh private links for published reports and returns the
// prefilled WhatsApp messages for staff to send (single report or the
// roster's bulk "Copy WhatsApp messages").
export async function POST(req: Request) {
  const body = (await req.json()) as { reportIds?: unknown };
  const ids = Array.isArray(body.reportIds) ? body.reportIds.filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: 'reportIds is required' }, { status: 400 });
  const actor = await adminEmail();
  const results = [];
  for (const reportId of ids) {
    const report = await getReport(reportId);
    if (!report) { results.push({ reportId, error: 'Report not found.' }); continue; }
    try {
      results.push({ reportId, links: await issueLinks(report, actor) });
    } catch (e) {
      results.push({ reportId, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results });
}
