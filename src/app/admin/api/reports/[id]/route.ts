import { NextResponse, after } from 'next/server';
import { adminEmail } from '@/lib/adminIdentity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { applyEdits } from '@/lib/reports/generate';
import {
  GenerationError, autosave, generateReport, getReport, getRevision, listRevisions, publish, revokeLinks,
  saveRevision, sendBack, submitForReview, workingContent,
} from '@/lib/reports/server';
import type { ReportContent } from '@/lib/reports/types';

type Params = { params: Promise<{ id: string }> };

// Everything the editor needs: the working copy, the published revision,
// revision history, the audit trail and the state of the parent links.
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const db = supabaseAdmin();
  const [content, revisions, published, { data: enrolment }, { data: events }, { data: links }] = await Promise.all([
    workingContent(report),
    listRevisions(id),
    report.published_revision_id ? getRevision(report.published_revision_id) : Promise.resolve(null),
    db.from('enrolments').select('id, session_id, kids(id, name)').eq('id', report.enrolment_id).single(),
    db.from('report_events').select('id, event, actor_type, actor_id, meta, at').eq('report_id', id).order('at', { ascending: false }).limit(100),
    db.from('report_links').select('id, guardian_lead_id, created_at, expires_at, revoked_at, last_used_at, leads(name)').eq('report_id', id).order('created_at', { ascending: false }),
  ]);
  return NextResponse.json({ report, content, published, revisions, enrolment, events: events ?? [], links: links ?? [] });
}

// Autosave into the working buffer only - no revision row, no event.
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const base = await workingContent(report);
  if (!base) return NextResponse.json({ error: 'Report has no content yet.' }, { status: 409 });
  const { content } = (await req.json()) as { content?: unknown };
  await autosave(id, applyEdits(base, content));
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

type Action = 'save' | 'submit' | 'send_back' | 'approve' | 'regenerate' | 'revoke_links';

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  const body = (await req.json()) as { action?: Action; content?: unknown; note?: unknown; comment?: unknown };
  const actor = await adminEmail();
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const edited = async (): Promise<ReportContent | null> => {
    if (body.content === undefined) return null;
    const base = await workingContent(report);
    return base ? applyEdits(base, body.content) : null;
  };

  try {
    switch (body.action) {
      case 'save': {
        const content = await edited();
        if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });
        const rev = await saveRevision(report, content, actor, note);
        return NextResponse.json({ ok: true, revisionNo: rev.revision_no });
      }
      case 'submit':
        await submitForReview(report, await edited(), actor, note);
        return NextResponse.json({ ok: true });
      case 'send_back': {
        const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
        if (!comment) return NextResponse.json({ error: 'Add a comment so the teacher knows what to change.' }, { status: 400 });
        await sendBack(report, comment.slice(0, 1000), actor);
        return NextResponse.json({ ok: true });
      }
      case 'approve': {
        const rev = await publish(report, await edited(), actor, note);
        prerenderPdf(rev.id, req);
        return NextResponse.json({ ok: true, revisionNo: rev.revision_no });
      }
      case 'regenerate':
        await generateReport(report.enrolment_id, actor, { regenerate: true });
        return NextResponse.json({ ok: true });
      case 'revoke_links':
        await revokeLinks(report.id, actor);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GenerationError ? 422 : 500 });
  }
}

// Render and store the PDF after the response so publishing stays fast. If
// this fails (e.g. no local Chrome) the parent's download renders it lazily.
function prerenderPdf(revisionId: string, req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  after(async () => {
    try {
      const { ensurePdf } = await import('@/lib/reports/pdf');
      await ensurePdf(revisionId, baseUrl);
    } catch (e) {
      console.error('report pdf prerender', e);
    }
  });
}
