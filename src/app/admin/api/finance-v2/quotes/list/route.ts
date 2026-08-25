import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Powers the v2 Quote Pipeline admin page and the Money & Admin dashboard's
// "Inventory" tiles - both were reading the old billing_records table and so
// never saw a single quote created through the finance-v2 composer or the
// self-serve Register Interest flow. This is the one place that reads the
// real quotes table for admin display, joined out to lead/program/invoice
// rows a plain quotes.select('*') can't reach.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leadIds = [...new Set((quotes || []).map((q) => q.lead_id).filter(Boolean))];
  const programIds = [...new Set((quotes || []).map((q) => q.program_id).filter(Boolean))];
  const quoteIds = (quotes || []).map((q) => q.id);

  const [{ data: leads }, { data: programs }, { data: invoices }] = await Promise.all([
    leadIds.length
      ? supabase.from('leads').select('id, name, phone, email').in('id', leadIds)
      : Promise.resolve({ data: [] as any[] }),
    programIds.length
      ? supabase.from('programs').select('id, name').in('id', programIds)
      : Promise.resolve({ data: [] as any[] }),
    quoteIds.length
      ? supabase.from('invoices').select('id, quote_id, status, amount, amount_paid').in('quote_id', quoteIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const leadById = new Map((leads || []).map((l: any) => [l.id, l]));
  const programById = new Map((programs || []).map((p: any) => [p.id, p]));
  const invoicesByQuote = new Map<string, any[]>();
  (invoices || []).forEach((inv: any) => {
    const arr = invoicesByQuote.get(inv.quote_id) || [];
    arr.push(inv);
    invoicesByQuote.set(inv.quote_id, arr);
  });

  const rows = (quotes || []).map((q: any) => ({
    ...q,
    lead: leadById.get(q.lead_id) || null,
    program: programById.get(q.program_id) || null,
    invoices: invoicesByQuote.get(q.id) || [],
  }));

  return NextResponse.json({ quotes: rows });
}
