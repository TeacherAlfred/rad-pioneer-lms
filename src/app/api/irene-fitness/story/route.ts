import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const LIMIT_150 = 150;
const LIMIT_100 = 100;

const STORY_FIELDS = [
  'motivation',
  'club_member',
  'club_names',
  'shoe_count',
  'boss_level_challenge_2026',
  'toughest_challenge',
  'proudest_moment',
  'weirdest_fuel',
  'funniest_fail',
] as const;

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// "Tell Your Story" (spec addendum) — every field here is optional, so this
// is a plain upsert keyed on response_id, not a validated multi-step
// transaction like /submit. "Skip for now" on any group calls this with
// whatever's been filled in so far; the preview screen's final Submit calls
// it with everything. Both are the same operation.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { response_id } = body;
    if (!response_id) {
      return NextResponse.json({ error: 'response_id is required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: response } = await supabase
      .from('irene_fitness_responses')
      .select('id')
      .eq('id', response_id)
      .single();
    if (!response) {
      return NextResponse.json({ error: 'Unknown response_id' }, { status: 404 });
    }

    let shoeCount: number | null = null;
    if (typeof body.shoe_count === 'number' && Number.isFinite(body.shoe_count)) {
      shoeCount = Math.max(0, Math.min(50, Math.round(body.shoe_count)));
    }

    const newFields = {
      motivation: clip(body.motivation, LIMIT_150),
      club_member: typeof body.club_member === 'boolean' ? body.club_member : null,
      club_names: clip(body.club_names, LIMIT_100),
      shoe_count: shoeCount,
      boss_level_challenge_2026: clip(body.boss_level_challenge_2026, LIMIT_150),
      toughest_challenge: clip(body.toughest_challenge, LIMIT_150),
      proudest_moment: clip(body.proudest_moment, LIMIT_150),
      weirdest_fuel: clip(body.weirdest_fuel, LIMIT_150),
      funniest_fail: clip(body.funniest_fail, LIMIT_150),
    } as Record<(typeof STORY_FIELDS)[number], string | boolean | number | null>;

    // Snapshot whatever was on record right before this overwrite - but
    // only the first time content actually changes (not a no-op re-save,
    // e.g. clicking through the story wizard without editing anything), and
    // never overwriting an existing snapshot: if the family edits again
    // before an admin has re-confirmed the prior edit, the QA drawer must
    // keep comparing against the last version an admin actually saw, not
    // the latest intermediate draft.
    const { data: existing } = await supabase
      .from('irene_fitness_response_story')
      .select(
        'motivation, club_member, club_names, shoe_count, boss_level_challenge_2026, toughest_challenge, proudest_moment, weirdest_fuel, funniest_fail, previous_snapshot'
      )
      .eq('response_id', response_id)
      .maybeSingle();

    const existingFields = existing as Record<string, unknown> | null;
    const contentChanged = !!existingFields && STORY_FIELDS.some((key) => existingFields[key] !== newFields[key]);

    const payload: Record<string, unknown> = {
      response_id,
      ...newFields,
      updated_at: new Date().toISOString(),
    };
    if (contentChanged && existingFields && !existingFields.previous_snapshot) {
      payload.previous_snapshot = Object.fromEntries(STORY_FIELDS.map((key) => [key, existingFields[key]]));
    }

    const { error } = await supabase
      .from('irene_fitness_response_story')
      .upsert(payload, { onConflict: 'response_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Irene fitness story route error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
