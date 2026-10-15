import { NextResponse } from 'next/server';
import { adminEmail } from '@/lib/adminIdentity';
import { GenerationError, generateReport } from '@/lib/reports/server';

// "Generate drafts": one draft per enrolment that has scores. Learners who
// already have a report are skipped (their edits are never overwritten)
// unless regenerate is set, which rebuilds the wording as a new revision.
export async function POST(req: Request) {
  const body = (await req.json()) as { enrolmentIds?: unknown; regenerate?: unknown };
  const ids = Array.isArray(body.enrolmentIds) ? body.enrolmentIds.filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: 'enrolmentIds is required' }, { status: 400 });
  const actor = await adminEmail();
  const results: { enrolmentId: string; reportId?: string; created?: boolean; error?: string }[] = [];
  for (const enrolmentId of ids) {
    try {
      const r = await generateReport(enrolmentId, actor, { regenerate: body.regenerate === true });
      results.push({ enrolmentId, ...r });
    } catch (e) {
      results.push({ enrolmentId, error: e instanceof GenerationError ? e.message : `Failed: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ results });
}
