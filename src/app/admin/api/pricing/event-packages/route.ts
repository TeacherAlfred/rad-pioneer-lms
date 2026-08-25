import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeCostRollup, computeRecommendedFee } from '@/lib/pricingEngine';

const TIER_ROLES = ['anchor', 'recommended', 'lighter'];
const OVERRIDE_CATEGORIES = ['penetration_pricing', 'loyalty_referral_discount', 'competitive_response', 'loss_leader_lead_gen', 'founder_discretion_other'];

// featured_program_id=<id> scopes to one program's attach-and-price rows
// (the featured-programs edit form's "Packages & Quote Email" section).
// No query param returns every row (used by /admin/pricing for a library-
// wide view of what's attached where).
export async function GET(request: Request) {
  const featuredProgramId = new URL(request.url).searchParams.get('featured_program_id');
  const supabase = supabaseAdmin();
  // featured_program title included so callers like the Quote Composer's
  // system-wide package picker can label each row "Package — attached
  // program (or Global)" without a second round trip.
  let query = supabase.from('event_packages').select('*, package:packages(*, items:package_items(*, inventory_item:inventory_items(*))), featured_program:featured_programs(id, title)').order('display_order', { ascending: true });
  if (featuredProgramId) query = query.eq('featured_program_id', featuredProgramId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Recomputes computed_cost/recommended_fee server-side from the package's
// current composition rather than trusting client-sent numbers - the
// client's live preview can drift from the source data between page load
// and save.
async function rollupFor(supabase: any, packageId: string, expectedAttendeeCount: number | null, targetMarginPct: number | null, unitMultiplier: number | null = 1) {
  const { data: items, error } = await supabase.from('package_items').select('quantity_type, quantity_override, inventory_item:inventory_items(cost_type, unit_cost)').eq('package_id', packageId);
  if (error) throw error;
  const rollupItems = (items || []).map((i: any) => ({
    cost_type: i.inventory_item?.cost_type || 'flat',
    unit_cost: Number(i.inventory_item?.unit_cost || 0),
    quantity_type: i.quantity_type,
    quantity_override: i.quantity_override,
  }));
  const computedCost = computeCostRollup(rollupItems, expectedAttendeeCount, unitMultiplier);
  const recommendedFee = computeRecommendedFee(computedCost, targetMarginPct);
  return { computedCost, recommendedFee };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { featured_program_id, package_id, tier_role, display_order, target_margin_pct, expected_attendee_count_override, unit_multiplier, display_name, display_description } = body;
    if (!package_id) return NextResponse.json({ error: 'package_id is required' }, { status: 400 });
    if (tier_role !== undefined && tier_role !== null && !TIER_ROLES.includes(tier_role)) {
      return NextResponse.json({ error: `tier_role must be one of: ${TIER_ROLES.join(', ')}` }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    let expectedAttendeeCount = expected_attendee_count_override ?? null;
    if (!expectedAttendeeCount && featured_program_id) {
      const { data: fp } = await supabase.from('featured_programs').select('expected_attendee_count').eq('id', featured_program_id).single();
      expectedAttendeeCount = fp?.expected_attendee_count ?? null;
    }
    const unitMultiplier = unit_multiplier === undefined || unit_multiplier === '' ? 1 : Number(unit_multiplier);
    const { computedCost, recommendedFee } = await rollupFor(supabase, package_id, expectedAttendeeCount, target_margin_pct ?? null, unitMultiplier);

    const { data, error } = await supabase
      .from('event_packages')
      .insert([{
        featured_program_id: featured_program_id || null,
        package_id,
        tier_role: tier_role || null,
        display_order: display_order === undefined || display_order === '' ? 0 : Number(display_order),
        expected_attendee_count_override: expected_attendee_count_override || null,
        unit_multiplier: unitMultiplier,
        computed_cost: computedCost,
        target_margin_pct: target_margin_pct === undefined || target_margin_pct === '' ? null : Number(target_margin_pct),
        recommended_fee: recommendedFee,
        display_name: display_name || null,
        display_description: display_description || null,
        published: false,
      }])
      .select('*, package:packages(*, items:package_items(*, inventory_item:inventory_items(*)))')
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Handles the full spec §3 steps 3-8 on one row: re-rolls the cost, accepts
// a final_fee, and lets the guardrail (event_packages_below_cost_needs_
// reason, in 20260827110000_pricing_engine_core.sql) reject the save if
// final_fee is below cost without an override reason - that Postgres error
// is passed straight through rather than duplicated as app-level validation.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, tier_role, display_order, target_margin_pct, expected_attendee_count_override, unit_multiplier, final_fee, margin_override_reason, override_reason_category, published, display_name, display_description } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (tier_role !== undefined && tier_role !== null && !TIER_ROLES.includes(tier_role)) {
      return NextResponse.json({ error: `tier_role must be one of: ${TIER_ROLES.join(', ')}` }, { status: 400 });
    }
    if (override_reason_category !== undefined && override_reason_category !== null && !OVERRIDE_CATEGORIES.includes(override_reason_category)) {
      return NextResponse.json({ error: `override_reason_category must be one of: ${OVERRIDE_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: existing, error: exErr } = await supabase.from('event_packages').select('*').eq('id', id).single();
    if (exErr || !existing) return NextResponse.json({ error: 'event_package not found' }, { status: 404 });

    const effectiveTargetMargin = target_margin_pct !== undefined ? (target_margin_pct === '' ? null : Number(target_margin_pct)) : existing.target_margin_pct;
    const effectiveUnitMultiplier = unit_multiplier !== undefined ? (unit_multiplier === '' ? 1 : Number(unit_multiplier)) : existing.unit_multiplier;
    let expectedAttendeeCount = expected_attendee_count_override !== undefined ? (expected_attendee_count_override || null) : existing.expected_attendee_count_override;
    if (!expectedAttendeeCount && existing.featured_program_id) {
      const { data: fp } = await supabase.from('featured_programs').select('expected_attendee_count').eq('id', existing.featured_program_id).single();
      expectedAttendeeCount = fp?.expected_attendee_count ?? null;
    }
    const { computedCost, recommendedFee } = await rollupFor(supabase, existing.package_id, expectedAttendeeCount, effectiveTargetMargin, effectiveUnitMultiplier);

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
      computed_cost: computedCost,
      target_margin_pct: effectiveTargetMargin,
      unit_multiplier: effectiveUnitMultiplier,
      recommended_fee: recommendedFee,
    };
    if (tier_role !== undefined) update.tier_role = tier_role;
    if (display_order !== undefined) update.display_order = display_order === '' ? 0 : Number(display_order);
    if (expected_attendee_count_override !== undefined) update.expected_attendee_count_override = expected_attendee_count_override || null;
    if (final_fee !== undefined) update.final_fee = final_fee === '' ? null : Number(final_fee);
    if (margin_override_reason !== undefined) update.margin_override_reason = margin_override_reason || null;
    if (override_reason_category !== undefined) update.override_reason_category = override_reason_category || null;
    if (published !== undefined) update.published = !!published;
    if (display_name !== undefined) update.display_name = display_name || null;
    if (display_description !== undefined) update.display_description = display_description || null;

    const { data, error } = await supabase
      .from('event_packages')
      .update(update)
      .eq('id', id)
      .select('*, package:packages(*, items:package_items(*, inventory_item:inventory_items(*)))')
      .single();
    if (error) {
      // Postgres check-violation code for the below-cost guardrail.
      if (error.code === '23514') {
        return NextResponse.json({ error: 'This final fee is below cost — an override reason and category are required.' }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('event_packages').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
