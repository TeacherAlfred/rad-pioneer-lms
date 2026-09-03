import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

// Locking is a governance record, not git enforcement - this route cannot
// and does not block real git operations. It just requires a branch name
// and a written risk/justification note before it will let the project be
// marked locked, mirroring the DB check constraint on projects.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = supabaseAdmin();

  if (body.locked === false) {
    const { data, error } = await supabase
      .from('projects')
      .update({
        locked: false,
        locked_at: null,
        lock_branch_name: null,
        lock_risk_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  }

  const branchName = (body.branch_name || '').trim();
  const riskNotes = (body.risk_notes || '').trim();
  if (!branchName || !riskNotes) {
    return NextResponse.json({ error: 'Branch name and risk/justification notes are required to lock a project.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      locked: true,
      locked_at: new Date().toISOString(),
      lock_branch_name: branchName,
      lock_risk_notes: riskNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
