import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeCostRollup, computeRecommendedFee } from '@/lib/pricingEngine';

// Re-saves computed_cost/recommended_fee for a specific set of event_
// packages (from the staleness audit) using their current item costs and
// attendee basis - exactly what a manual re-save through the pricing
// wizard already does on every PATCH, just applied in bulk. final_fee is
// never touched here - refreshing the cost reference is not the same
// decision as changing what a lead is actually charged.
export async function POST(request: Request) {
  const body = await request.json();
  const { ids } = body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids (array of event_package ids) is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: eventPackages, error } = await supabase
    .from('event_packages')
    .select('*, featured_program:featured_programs(expected_attendee_count)')
    .in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const packageIds = [...new Set((eventPackages || []).map((e: any) => e.package_id))];
  const { data: allItems } = packageIds.length
    ? await supabase.from('package_items').select('*, inventory_item:inventory_items(unit_cost)').in('package_id', packageIds)
    : { data: [] as any[] };
  const itemsByPackage = new Map<string, any[]>();
  (allItems || []).forEach((i: any) => {
    const arr = itemsByPackage.get(i.package_id) || [];
    arr.push(i);
    itemsByPackage.set(i.package_id, arr);
  });

  const updated: any[] = [];
  const failed: any[] = [];
  for (const ep of eventPackages || []) {
    const items = (itemsByPackage.get(ep.package_id) || []).map((i: any) => ({
      cost_type: i.inventory_item?.cost_type || 'flat',
      unit_cost: Number(i.inventory_item?.unit_cost || 0),
      quantity_type: i.quantity_type,
      quantity_override: i.quantity_override,
    }));
    const attendees = ep.expected_attendee_count_override || ep.featured_program?.expected_attendee_count || null;
    const computedCost = computeCostRollup(items, attendees, ep.unit_multiplier);
    const recommendedFee = computeRecommendedFee(computedCost, ep.target_margin_pct);

    const { data, error: updError } = await supabase
      .from('event_packages')
      .update({ computed_cost: computedCost, recommended_fee: recommendedFee, updated_at: new Date().toISOString() })
      .eq('id', ep.id)
      .select()
      .single();
    if (updError) {
      // Below-cost guardrail can legitimately trip here if the true cost
      // rose above an already-set final_fee - surfaced, not silently
      // skipped, since that's exactly the margin risk this audit exists to catch.
      failed.push({ id: ep.id, error: updError.code === '23514' ? 'Refreshed cost is now above final_fee - needs an override reason before this can save.' : updError.message });
      continue;
    }
    updated.push(data);
  }

  return NextResponse.json({ updated, failed });
}
