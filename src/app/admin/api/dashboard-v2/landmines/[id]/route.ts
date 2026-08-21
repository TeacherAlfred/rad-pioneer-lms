import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { state, next_action, owner } = body as { state?: string; next_action?: string; owner?: string };

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (state) update.state = state;
  if (next_action !== undefined) update.next_action = next_action;
  if (owner) update.owner = owner;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('landmines').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
