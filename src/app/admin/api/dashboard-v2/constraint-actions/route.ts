import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VALID_STATES = ['lead_volume', 'founder_attention', 'fulfilment_capacity', 'recurring_revenue_quality'];

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('constraint_actions').select('*').order('constraint_state').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { constraint_state, label, target, unit, period_label } = body as {
    constraint_state: string; label: string; target?: number; unit?: string; period_label?: string;
  };

  if (!VALID_STATES.includes(constraint_state)) {
    return NextResponse.json({ error: `Invalid constraint_state: ${constraint_state}` }, { status: 400 });
  }
  if (!label || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: maxRow } = await supabase
    .from('constraint_actions')
    .select('sort_order')
    .eq('constraint_state', constraint_state)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('constraint_actions')
    .insert({ constraint_state, label: label.trim(), target: target ?? null, unit: unit || null, period_label: period_label || null, sort_order: nextSort })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data });
}
