import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const label = (body.label || '').trim();
  if (!label) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { count } = await supabase
    .from('project_checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id);

  const { data, error } = await supabase
    .from('project_checklist_items')
    .insert({ project_id: id, label, sort_order: count || 0 })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
