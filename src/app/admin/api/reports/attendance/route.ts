import { NextResponse } from 'next/server';
import { saveAttendance } from '@/lib/reports/server';

const STATES = ['present', 'missed', 'caught_up'] as const;
type State = typeof STATES[number];

// Lessons are recorded as exceptions: "present" deletes the row.
export async function POST(req: Request) {
  const body = (await req.json()) as { enrolmentId?: unknown; lessonNo?: unknown; state?: unknown };
  if (typeof body.enrolmentId !== 'string' || typeof body.lessonNo !== 'number' || !Number.isInteger(body.lessonNo) || body.lessonNo < 1
    || !STATES.includes(body.state as State)) {
    return NextResponse.json({ error: 'enrolmentId, lessonNo and state (present | missed | caught_up) are required' }, { status: 400 });
  }
  try {
    await saveAttendance(body.enrolmentId, body.lessonNo, body.state as State);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
