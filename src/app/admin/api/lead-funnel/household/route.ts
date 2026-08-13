import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Groups 2+ leads (e.g. both parents of the same child) under one
// household_id so reporting can tell "two contacts, one family" from
// "two separate prospects" - each lead keeps its own conversation,
// status, and funnel stage; linking only changes how they're counted
// and displayed, never merges the underlying records.
export async function POST(req: Request) {
  try {
    const { leadIds, name } = await req.json();
    if (!Array.isArray(leadIds) || leadIds.length < 2) {
      return NextResponse.json({ error: 'Select at least 2 leads to link as a household' }, { status: 400 });
    }

    const { data: existingLeads, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('id, household_id, name')
      .in('id', leadIds);
    if (fetchErr) throw fetchErr;

    // Reuse an existing household if any selected lead already has one -
    // this is also how a third lead gets added to an already-linked
    // household later, rather than creating a duplicate.
    const existingHouseholdId = (existingLeads || []).find(l => l.household_id)?.household_id;

    let householdId = existingHouseholdId;
    if (householdId) {
      if (name?.trim()) {
        await supabaseAdmin.from('households').update({ name: name.trim() }).eq('id', householdId);
      }
    } else {
      const defaultName = name?.trim() || (existingLeads || []).map(l => l.name).filter(Boolean).join(' & ') || 'Household';
      const { data: newHousehold, error: createErr } = await supabaseAdmin
        .from('households')
        .insert([{ name: defaultName }])
        .select()
        .single();
      if (createErr) throw createErr;
      householdId = newHousehold.id;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('leads')
      .update({ household_id: householdId })
      .in('id', leadIds);
    if (updateErr) throw updateErr;

    return NextResponse.json({ householdId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
