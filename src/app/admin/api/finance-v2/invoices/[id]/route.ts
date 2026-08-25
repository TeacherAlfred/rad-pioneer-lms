import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// The auto-calculated schedule (accepted_at, +1 month, +2 months...) is a
// reasonable default, not a rule - a returning parent with a track record
// shouldn't be forced onto it. Due date only, deliberately: that's the one
// thing that actually needs correcting case by case; amount/status change
// through payment, not admin edit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { due_at } = body;
  if (!due_at) return NextResponse.json({ error: 'due_at is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: invoice, error } = await supabase.from('invoices').update({ due_at }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  return NextResponse.json({ invoice });
}
