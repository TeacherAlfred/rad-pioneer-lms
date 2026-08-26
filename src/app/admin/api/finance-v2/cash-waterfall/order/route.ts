import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Persists a manual reorder of one month's payment-priority list. Always a
// full replace of that month's saved sequence, not a partial patch - see
// the migration comment for why (avoids rank-collision ambiguity when
// items get inserted between others on a later reorder).
export async function POST(request: Request) {
  const body = await request.json();
  const { month, order } = body as { month: string; order: string[] };
  if (!month || !Array.isArray(order)) {
    return NextResponse.json({ error: 'month and order (array of item ids) are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error: deleteError } = await supabase.from('cash_waterfall_priority_overrides').delete().eq('month', month);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (order.length > 0) {
    const rows = order.map((item_key, sort_index) => ({ month, item_key, sort_index }));
    const { error: insertError } = await supabase.from('cash_waterfall_priority_overrides').insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Clears the override, reverting that month back to plain due-date order.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month query param is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('cash_waterfall_priority_overrides').delete().eq('month', month);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
