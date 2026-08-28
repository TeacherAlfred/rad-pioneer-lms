import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findOrCreateLeadByPhone } from '@/lib/leadFinance';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const q = searchParams.get('q') || '';

  const supabase = supabaseAdmin();
  const columns = 'id, name, phone, email, number_of_children, customer_type, company_name';

  // ?id= is a direct lookup (used to prefill a specific lead, e.g. deep-linking
  // into Payment Capture from the Invoices list) - skips the 3-char q minimum
  // and the name/phone/company_name search entirely.
  if (id) {
    const { data, error } = await supabase.from('leads').select(columns).eq('id', id).single();
    if (error || !data) return NextResponse.json({ leads: [] });
    return NextResponse.json({ leads: [data] });
  }

  if (q.length < 3) return NextResponse.json({ leads: [] });

  const { data, error } = await supabase
    .from('leads')
    .select(columns)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`)
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { phone, name, email, source } = body;
  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const lead = await findOrCreateLeadByPhone(supabase, { phone, name, email, source: source || 'finance_v2_composer' });
  if (!lead) return NextResponse.json({ error: 'Failed to find or create lead' }, { status: 500 });
  return NextResponse.json({ lead });
}
