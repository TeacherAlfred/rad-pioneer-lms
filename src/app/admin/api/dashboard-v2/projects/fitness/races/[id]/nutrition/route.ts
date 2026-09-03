import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const {
    plan_carbs_g_per_hr,
    plan_hydration_strategy,
    plan_gel_brand,
    plan_caffeine_timing,
    plan_notes,
    actual_carbs_g_per_hr,
    actual_hydration_notes,
    actual_gi_issues,
    actual_fueling_rating,
    actual_notes,
  } = body ?? {};

  if (actual_fueling_rating != null && (actual_fueling_rating < 1 || actual_fueling_rating > 5)) {
    return NextResponse.json({ error: 'actual_fueling_rating must be between 1 and 5' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // A PATCH here is typically partial (e.g. the Actuals tab saved on its
  // own, well after the Plan tab). Fetch the existing row first and merge
  // rather than upserting the raw body directly, or fields omitted from
  // this request would get overwritten with null.
  const { data: existing } = await sb.from('fitness_race_nutrition').select('*').eq('race_id', id).maybeSingle();

  const merged = {
    race_id: id,
    plan_carbs_g_per_hr: plan_carbs_g_per_hr !== undefined ? plan_carbs_g_per_hr : (existing?.plan_carbs_g_per_hr ?? null),
    plan_hydration_strategy: plan_hydration_strategy !== undefined ? plan_hydration_strategy : (existing?.plan_hydration_strategy ?? null),
    plan_gel_brand: plan_gel_brand !== undefined ? plan_gel_brand : (existing?.plan_gel_brand ?? null),
    plan_caffeine_timing: plan_caffeine_timing !== undefined ? plan_caffeine_timing : (existing?.plan_caffeine_timing ?? null),
    plan_notes: plan_notes !== undefined ? plan_notes : (existing?.plan_notes ?? null),
    actual_carbs_g_per_hr: actual_carbs_g_per_hr !== undefined ? actual_carbs_g_per_hr : (existing?.actual_carbs_g_per_hr ?? null),
    actual_hydration_notes: actual_hydration_notes !== undefined ? actual_hydration_notes : (existing?.actual_hydration_notes ?? null),
    actual_gi_issues: actual_gi_issues !== undefined ? actual_gi_issues : (existing?.actual_gi_issues ?? null),
    actual_fueling_rating: actual_fueling_rating !== undefined ? actual_fueling_rating : (existing?.actual_fueling_rating ?? null),
    actual_notes: actual_notes !== undefined ? actual_notes : (existing?.actual_notes ?? null),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb.from('fitness_race_nutrition').upsert(merged, { onConflict: 'race_id' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, nutrition: data });
}
