import { NextResponse } from 'next/server';
import { adminEmail } from '@/lib/adminIdentity';
import { saveScores } from '@/lib/reports/server';

// Saves rubric levels for one learner. scores maps area id -> level id;
// an empty string clears that area.
export async function POST(req: Request) {
  const body = (await req.json()) as { enrolmentId?: unknown; scores?: unknown };
  if (typeof body.enrolmentId !== 'string' || !body.scores || typeof body.scores !== 'object') {
    return NextResponse.json({ error: 'enrolmentId and scores are required' }, { status: 400 });
  }
  const scores = Object.fromEntries(
    Object.entries(body.scores as Record<string, unknown>).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>;
  try {
    await saveScores(body.enrolmentId, scores, await adminEmail());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
