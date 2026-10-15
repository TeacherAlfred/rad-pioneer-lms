import { NextResponse } from 'next/server';
import { loadRoster, loadRubrics, loadRun, setLessonsPlanned } from '@/lib/reports/server';

// One programme run: the roster with scores, attendance and report state,
// plus the active rubrics the capture screen scores against.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  try {
    const run = await loadRun(sessionId);
    if (!run) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    const [roster, rubrics] = await Promise.all([loadRoster(sessionId), loadRubrics()]);
    return NextResponse.json({ run, roster, rubrics });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { sessionId?: unknown; lessonsPlanned?: unknown };
  if (typeof body.sessionId !== 'string') return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  const n = body.lessonsPlanned;
  if (n !== null && (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 60)) {
    return NextResponse.json({ error: 'lessonsPlanned must be a whole number from 1 to 60' }, { status: 400 });
  }
  try {
    await setLessonsPlanned(body.sessionId, n);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
