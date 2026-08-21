import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const [{ data: lead }, { data: lineItems }] = await Promise.all([
    supabase.from('leads').select('id, name, phone, email').eq('id', invoice.lead_id).single(),
    invoice.quote_id
      ? supabase.from('quote_line_items').select('*').eq('quote_id', invoice.quote_id).order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ invoice, lead, lineItems: lineItems || [] });
}
