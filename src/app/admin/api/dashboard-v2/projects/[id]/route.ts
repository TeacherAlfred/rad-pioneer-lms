import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

const PATCHABLE_FIELDS = ['name', 'description', 'category', 'status', 'href', 'sort_order'] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const [{ data: project, error }, { data: checklist }, { data: attachments }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('project_checklist_items').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('project_attachments').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
  ]);

  if (error || !project) {
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ project, checklist: checklist || [], attachments: attachments || [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: project } = await supabase.from('projects').select('stage').eq('id', id).single();
  if (project?.stage === 'active') {
    return NextResponse.json({ error: 'Active projects cannot be deleted - archive instead by editing its status.' }, { status: 400 });
  }

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
