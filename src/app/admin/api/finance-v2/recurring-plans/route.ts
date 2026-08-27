import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// recurring_billing_plans is RLS-locked with zero anon policies (matches
// quotes/leads/invoices), so reads/writes go through here rather than the
// browser supabase client. Also returns the lead and its accepted quotes -
// the admin recurring-billing page needs both to build/edit a plan.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const [{ data: lead, error: leadError }, { data: acceptedQuotes }, { data: plans, error: plansError }] = await Promise.all([
    supabase.from('leads').select('id, name, phone, email, customer_type, company_name, billing_address').eq('id', leadId).single(),
    supabase.from('quotes').select('id, quote_number, total_amount, status').eq('lead_id', leadId).eq('status', 'accepted').order('created_at', { ascending: false }),
    supabase.from('recurring_billing_plans').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
  ]);
  if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (plansError) return NextResponse.json({ error: plansError.message }, { status: 500 });

  return NextResponse.json({ lead, acceptedQuotes: acceptedQuotes || [], plans: plans || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { lead_id, source_quote_id, line_items, total_amount, next_due_date, notes } = body;

  if (!lead_id || !Array.isArray(line_items) || line_items.length === 0 || !total_amount || !next_due_date) {
    return NextResponse.json(
      { error: 'lead_id, line_items, total_amount, and next_due_date are required' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: plan, error } = await supabase
    .from('recurring_billing_plans')
    .insert({
      lead_id,
      source_quote_id: source_quote_id || null,
      line_items,
      total_amount,
      next_due_date,
      notes: notes || null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan });
}
