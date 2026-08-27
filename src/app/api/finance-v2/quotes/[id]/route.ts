import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public - no auth, reached from a shared quote link. quotes/quote_line_items/
// leads all have zero anon RLS policies, so this must run server-side.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', id).single();
  if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

  const [{ data: lineItems }, { data: lead }, { data: invoices }] = await Promise.all([
    supabase.from('quote_line_items').select('*').eq('quote_id', id).order('sort_order'),
    supabase.from('leads').select('id, name, phone, email, is_customer, lifecycle_stage, customer_type, company_name').eq('id', quote.lead_id).single(),
    quote.status === 'accepted'
      ? supabase.from('invoices').select('*').eq('quote_id', id).order('sequence_number')
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ quote, lineItems: lineItems || [], lead, invoices: invoices || [] });
}
