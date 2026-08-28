import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// The Quote Pipeline only ever showed invoices nested inside a specific
// quote's Manage modal - there was no way to see "every invoice, across
// every client, sorted by what's actually due" in one place. This is that
// list, same join shape as quotes/list (lead + quote joined out) so the
// admin Invoices page can show who owes what without a second lookup.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('due_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leadIds = [...new Set((invoices || []).map((inv) => inv.lead_id).filter(Boolean))];
  const quoteIds = [...new Set((invoices || []).map((inv) => inv.quote_id).filter(Boolean))];

  const [{ data: leads }, { data: quotes }] = await Promise.all([
    leadIds.length
      ? supabase.from('leads').select('id, name, phone, email, customer_type, company_name').in('id', leadIds)
      : Promise.resolve({ data: [] as any[] }),
    quoteIds.length
      ? supabase.from('quotes').select('id, quote_number').in('id', quoteIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const leadById = new Map((leads || []).map((l: any) => [l.id, l]));
  const quoteById = new Map((quotes || []).map((q: any) => [q.id, q]));

  const rows = (invoices || []).map((inv: any) => ({
    ...inv,
    outstanding: Math.max(0, Number(inv.amount) - Number(inv.amount_paid || 0)),
    lead: leadById.get(inv.lead_id) || null,
    quote: quoteById.get(inv.quote_id) || null,
  }));

  return NextResponse.json({ invoices: rows });
}
