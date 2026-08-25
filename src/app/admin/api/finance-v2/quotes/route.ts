import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from('quotes').select('quote_number').order('quote_number', { ascending: false }).limit(1);
  return NextResponse.json({ nextQuoteNumber: (data?.[0]?.quote_number || 0) + 1 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { lead_id, program_id, total_amount, installment_count, monthly_installment_amount, expires_at, notes, line_items } = body;

  if (!lead_id || !program_id || !total_amount || !Array.isArray(line_items) || line_items.length === 0) {
    return NextResponse.json({ error: 'lead_id, program_id, total_amount, and line_items are required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  try {
    // Computed fresh at insert time (not trusting a number the client fetched
    // earlier for display) - same low-volume-accepted race as the old
    // composer's nextInvNum pattern.
    const { data: qmax } = await supabase.from('quotes').select('quote_number').order('quote_number', { ascending: false }).limit(1);
    const quoteNumber = (qmax?.[0]?.quote_number || 0) + 1;

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        lead_id,
        program_id,
        status: 'sent',
        total_amount,
        currency: 'ZAR',
        installment_count: installment_count || 1,
        is_open_ended: false,
        monthly_installment_amount: monthly_installment_amount || null,
        expires_at,
        notes: notes || null,
        created_by: 'admin',
      })
      .select('id, quote_number')
      .single();
    if (quoteError) throw quoteError;

    const { error: linesError } = await supabase.from('quote_line_items').insert(
      line_items.map((li: any, idx: number) => ({
        quote_id: quote.id,
        description: li.description,
        program_id: li.program_id || null,
        session_id: li.session_id || null,
        event_package_id: li.event_package_id || null,
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount_pct: li.discount_pct,
        line_total: li.quantity * li.unit_price * (1 - Math.max(0, li.discount_pct) / 100),
        sort_order: idx,
      }))
    );
    if (linesError) throw linesError;

    return NextResponse.json({ quote });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
