import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeCostRollup, computeRecommendedFee } from '@/lib/pricingEngine';

// computed_cost/recommended_fee are snapshots, persisted at save time -
// they silently drift whenever an inventory_item's unit_cost changes, or a
// featured_program's expected_attendee_count changes, without anyone
// re-saving the event_packages row that depends on them (a package doesn't
// know it's downstream of either). This is the audit: recompute every
// row's cost fresh, right now, and flag anything that no longer matches
// what's stored - the same drift that produced the R110-vs-R145 mismatch
// on Pretoria Workshop.
export async function GET() {
  const supabase = supabaseAdmin();

  const { data: eventPackages, error } = await supabase
    .from('event_packages')
    .select('*, package:packages(name), featured_program:featured_programs(title, expected_attendee_count)');
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

  const results = (eventPackages || []).map((ep: any) => {
    const items = (itemsByPackage.get(ep.package_id) || []).map((i: any) => ({
      cost_type: i.inventory_item?.cost_type || 'flat',
      unit_cost: Number(i.inventory_item?.unit_cost || 0),
      quantity_type: i.quantity_type,
      quantity_override: i.quantity_override,
    }));
    const attendees = ep.expected_attendee_count_override || ep.featured_program?.expected_attendee_count || null;
    const freshCost = computeCostRollup(items, attendees, ep.unit_multiplier);
    const freshFee = computeRecommendedFee(freshCost, ep.target_margin_pct);
    const storedCost = ep.computed_cost !== null ? Number(ep.computed_cost) : null;
    const isStale = storedCost === null || Math.abs(freshCost - storedCost) > 0.01;
    // A global package (no featured_program, no override) has no live
    // attendee basis at all - "fresh" here assumes 1, which usually isn't
    // meaningful. Flagged separately so it reads as "needs a decision,"
    // not "just click refresh," unlike a normal drifted attached package.
    const needsAttendeeDecision = !attendees && items.some((i: any) => i.quantity_type === 'flat' && i.unit_cost > 0);

    return {
      id: ep.id,
      package_name: ep.package?.name || 'Package',
      display_name: ep.display_name,
      featured_program_title: ep.featured_program?.title || null,
      published: ep.published,
      final_fee: ep.final_fee,
      attendees_used: attendees,
      stored_cost: storedCost,
      fresh_cost: freshCost,
      fresh_recommended_fee: freshFee,
      is_stale: isStale,
      needs_attendee_decision: needsAttendeeDecision,
    };
  });

  return NextResponse.json({
    total: results.length,
    staleCount: results.filter((r) => r.is_stale).length,
    results,
  });
}
