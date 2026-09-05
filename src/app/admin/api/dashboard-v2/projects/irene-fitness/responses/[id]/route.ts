import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

const STORY_FIELDS = [
  'motivation',
  'toughest_challenge',
  'proudest_moment',
  'weirdest_fuel',
  'funniest_fail',
  'boss_level_challenge_2026',
] as const;
type StoryFieldKey = (typeof STORY_FIELDS)[number];

// Full response detail for the admin "click a name" drawer on the
// Responses page - story text plus whatever category_overrides are already
// set, so the admin can see (and fix) exactly what a visitor would see when
// e.g. the "funniest fail" field is blank or literally "N/A".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: response, error: responseError } = await supabase
    .from('irene_fitness_responses')
    .select('id, display_name')
    .eq('id', id)
    .single();
  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  const { data: story, error: storyError } = await supabase
    .from('irene_fitness_response_story')
    .select(
      'motivation, club_member, club_names, shoe_count, boss_level_challenge_2026, toughest_challenge, proudest_moment, weirdest_fuel, funniest_fail, category_overrides, featured_category'
    )
    .eq('response_id', id)
    .maybeSingle();
  if (storyError) return NextResponse.json({ error: storyError.message }, { status: 500 });

  return NextResponse.json({ display_name: response.display_name, story: story || null });
}

// Toggles a response's QA sign-off (irene_fitness_responses), and/or saves
// which field should stand in for a category's public display when the
// default (funniest_fail / proudest_moment.../weirdest_fuel...) is missing
// or inadequate (irene_fitness_response_story.category_overrides), and/or
// which category supplies the single teaser line shown on every card before
// "Read full story" - that teaser always defaulted to funniest_fail
// regardless of category (irene_fitness_response_story.featured_category;
// null keeps that old default). All keyed off the response id, just
// different tables/columns. [id] is the response id
// (irene_fitness_responses.id / response_story.response_id), not the family
// id the response table row list is otherwise keyed by admin-side.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { qa_confirmed, category_overrides, featured_category } = body as {
    qa_confirmed?: boolean;
    // 'blank' marks a category as having nothing real to show (e.g. the
    // family wrote "Nothing really") - distinct from `null`, which just
    // clears back to auto-detect. Never falls through to another field.
    category_overrides?: Partial<Record<VoteCategory, StoryFieldKey | 'blank' | null>>;
    featured_category?: VoteCategory | null;
  };

  if (typeof qa_confirmed !== 'boolean' && !category_overrides && featured_category === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  if (featured_category !== undefined && featured_category !== null && !VOTE_CATEGORIES.includes(featured_category)) {
    return NextResponse.json({ error: `Invalid featured_category: ${featured_category}` }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  if (typeof qa_confirmed === 'boolean') {
    const { error } = await supabase
      .from('irene_fitness_responses')
      .update({ qa_confirmed, qa_confirmed_at: qa_confirmed ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (category_overrides) {
    for (const [cat, field] of Object.entries(category_overrides)) {
      if (!VOTE_CATEGORIES.includes(cat as VoteCategory)) {
        return NextResponse.json({ error: `Invalid category: ${cat}` }, { status: 400 });
      }
      if (field !== null && field !== 'blank' && !STORY_FIELDS.includes(field as StoryFieldKey)) {
        return NextResponse.json({ error: `Invalid field: ${field}` }, { status: 400 });
      }
    }

    const { data: existing, error: fetchError } = await supabase
      .from('irene_fitness_response_story')
      .select('category_overrides')
      .eq('response_id', id)
      .maybeSingle();
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'No story on file for this response' }, { status: 400 });

    const merged: Partial<Record<VoteCategory, StoryFieldKey | 'blank'>> = { ...(existing.category_overrides || {}) };
    for (const [cat, field] of Object.entries(category_overrides)) {
      if (field === null) delete merged[cat as VoteCategory];
      else merged[cat as VoteCategory] = field;
    }

    const { error: updateError } = await supabase
      .from('irene_fitness_response_story')
      .update({ category_overrides: merged })
      .eq('response_id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (featured_category !== undefined) {
    const { error } = await supabase
      .from('irene_fitness_response_story')
      .update({ featured_category })
      .eq('response_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
