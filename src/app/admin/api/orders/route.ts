import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ORDER_STATUSES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A purchase by a Guardian (leads row). What was bought - a pass, a
// bundle, or a single direct session - is inferred from what references
// the order (a passes row, bundle_id here, or an enrolment's order_id),
// not a separate "kind" field. No DELETE route - financial records
// aren't removed, only cancelled/refunded via status.
// ?guardianLeadId= scopes to one lead's orders (used by the Lead Funnel
// quick-view drawer) - omitted, returns everyone (used by /admin/commerce).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const guardianLeadId = searchParams.get('guardianLeadId');

  let query = supabaseAdmin
    .from('orders')
    .select('*, leads(id, name, phone), bundles(id, name)')
    .order('created_at', { ascending: false });
  if (guardianLeadId) query = query.eq('guardian_lead_id', guardianLeadId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const { guardianLeadId, bundleId, amount_total, currency, status, payment_reference, notes } = await req.json();
    if (!guardianLeadId) return NextResponse.json({ error: 'guardianLeadId is required' }, { status: 400 });
    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert([{
        guardian_lead_id: guardianLeadId,
        bundle_id: bundleId || null,
        amount_total: amount_total === '' || amount_total === undefined ? null : Number(amount_total),
        currency: currency || 'ZAR',
        status: status || 'pending',
        payment_reference: payment_reference || null,
        notes: notes || null,
      }])
      .select('*, leads(id, name, phone), bundles(id, name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, amount_total, currency, status, payment_reference, notes } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` }, { status: 400 });
    }
    const update: Record<string, any> = {};
    if (amount_total !== undefined) update.amount_total = amount_total === '' ? null : Number(amount_total);
    if (currency !== undefined) update.currency = currency || 'ZAR';
    if (status !== undefined) update.status = status;
    if (payment_reference !== undefined) update.payment_reference = payment_reference || null;
    if (notes !== undefined) update.notes = notes || null;
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', id)
      .select('*, leads(id, name, phone), bundles(id, name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
