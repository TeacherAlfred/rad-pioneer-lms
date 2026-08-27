import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Full line-item replace + due-date edit for an already-created quote (fee/
// quantity/description/due date) - the dedicated quotes/[id] PATCH route
// only handles status transitions and refuses once a quote is accepted, but
// an evergreen recurring quote (like a consulting retainer) still needs its
// terms correctable after acceptance. Keeps a linked recurring plan's
// cached amount in step, since invoices only store a single `amount` and
// pull their line-item description from this quote at render time - an
// edit that didn't propagate would leave the wrong amount going out monthly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { line_items, expires_at } = body;

  if (!Array.isArray(line_items) || line_items.length === 0 || line_items.some((li) => !li.description || !(li.quantity > 0) || li.unit_price < 0)) {
    return NextResponse.json({ error: 'Every line needs a description, a quantity above 0, and a unit price.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  try {
    const { data: quote, error: quoteFetchError } = await supabase.from('quotes').select('id').eq('id', id).single();
    if (quoteFetchError || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const rows = line_items.map((li, idx: number) => ({
      quote_id: id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      discount_pct: li.discount_pct || 0,
      line_total: li.quantity * li.unit_price * (1 - Math.max(0, li.discount_pct || 0) / 100),
      sort_order: idx,
    }));
    const totalAmount = rows.reduce((sum, r) => sum + r.line_total, 0);

    const { error: deleteError } = await supabase.from('quote_line_items').delete().eq('quote_id', id);
    if (deleteError) throw deleteError;
    const { data: newLines, error: insertError } = await supabase.from('quote_line_items').insert(rows).select('*').order('sort_order');
    if (insertError) throw insertError;

    const { data: updatedQuote, error: updateError } = await supabase
      .from('quotes')
      .update({ total_amount: totalAmount, expires_at: expires_at || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const cachedLineItems = rows.map(({ description, quantity, unit_price, discount_pct }) => ({ description, quantity, unit_price, discount_pct }));
    await supabase
      .from('recurring_billing_plans')
      .update({ line_items: cachedLineItems, total_amount: totalAmount, updated_at: new Date().toISOString() })
      .eq('source_quote_id', id)
      .neq('status', 'cancelled');

    return NextResponse.json({ quote: updatedQuote, lineItems: newLines });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
