import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('lead_id', id)
    .in('status', ['pending', 'partially_paid'])
    .order('due_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data || [])
    .map((inv) => ({ ...inv, outstanding: Math.max(0, Number(inv.amount) - Number(inv.amount_paid || 0)) }))
    .filter((inv) => inv.outstanding > 0);
  return NextResponse.json({ invoices: enriched });
}
