import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { state, notes } = body as { state?: string; notes?: string };

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (state) update.state = state;
  if (notes !== undefined) update.notes = notes;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('system_checklist_items').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
