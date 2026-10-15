import { NextResponse } from 'next/server';
import { applyEdits, pdfFilename } from '@/lib/reports/generate';
import { autosave, getReport, signPrint, workingContent } from '@/lib/reports/server';
import { renderPrintPage } from '@/lib/reports/pdfRender';

export const maxDuration = 60;

// A4 draft PDF of what's in the editor right now, watermarked DRAFT. The
// editor's current content is autosaved into the working buffer first (the
// same thing autosave would do a few seconds later) so the print page
// renders exactly what staff see. Never stored, never sent to parents.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const base = await workingContent(report);
  if (!base) return NextResponse.json({ error: 'Report has no content yet.' }, { status: 409 });

  const { content } = (await req.json().catch(() => ({}))) as { content?: unknown };
  const current = content === undefined ? base : applyEdits(base, content);
  if (content !== undefined) await autosave(id, current);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const sig = encodeURIComponent(signPrint(`draft:${id}`));
    const pdf = await renderPrintPage(`${baseUrl}/r/print-draft/${id}?sig=${sig}`, { draft: true });
    const filename = `DRAFT-${pdfFilename(current.learner.first_name, current.period_label)}`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Draft PDF failed: ${(e as Error).message}` }, { status: 500 });
  }
}
