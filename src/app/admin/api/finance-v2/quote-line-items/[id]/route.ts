import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Retroactively attaches (or clears) a priced Pricing Package on a quote
// line item that didn't get one at quote-creation time (the Composer's
// "Pricing Package" line source already sets this going forward - this is
// the same field, just editable from the Cost Linking tab for lines that
// were freeform/programme instead). Once set, the line's cost comes from
// event_packages.computed_cost - already-guardrailed pricing data - instead
// of needing inventory items linked one by one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { event_package_id } = body;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('quote_line_items')
    .update({ event_package_id: event_package_id || null })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lineItem: data });
}
