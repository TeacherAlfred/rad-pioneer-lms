import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/reports/server';

// Programme runs (top-level sessions) that have learners, for the report
// cards index. Behind the /admin middleware allowlist like every route here.
export async function GET() {
  try {
    return NextResponse.json({ runs: await listRuns() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
