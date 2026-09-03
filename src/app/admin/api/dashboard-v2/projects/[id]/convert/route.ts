import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

// Flips an idea into a tracked project. This only changes the record's
// stage - it does not scaffold a bespoke sub-app (like Irene Fitness). If
// one gets built later, set the project's href by hand once it exists.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const supabase = supabaseAdmin();
  const { data: existing, error: fetchError } = await supabase.from('projects').select('stage').eq('id', id).single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message || 'Not found' }, { status: 404 });
  }
  if (existing.stage === 'active') {
    return NextResponse.json({ error: 'Already converted' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    stage: 'active',
    converted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (body.category) updates.category = body.category;
  if (body.status) updates.status = body.status;

  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
