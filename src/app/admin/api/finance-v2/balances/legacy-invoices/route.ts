import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Read-only: lists a legacy guardian's billing_records so the admin can pick
// one to reference (invoice number) when typing in a brought-forward
// balance. Purely for finding the right document later - the amount/date
// actually brought forward are always typed in separately, not derived
// from this record.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guardianId = searchParams.get('guardian_id');
  if (!guardianId) return NextResponse.json({ error: 'guardian_id is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('billing_records')
    .select('id, invoice_number, status, total_amount, amount_paid, created_at, doc_type')
    .eq('guardian_id', guardianId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data || [] });
}
