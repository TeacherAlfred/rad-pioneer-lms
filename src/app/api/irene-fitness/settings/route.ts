import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Lightweight, FAQ-only read - deliberately separate from /api/irene-fitness/feed
// (which also returns every public response) since this is fetched from the
// header on every irene-fitness page, including the submission flow where the
// full feed payload would be unused weight.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('irene_fitness_voting_settings')
    .select('results_announcement_date, submissions_open')
    .eq('id', 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    results_announcement_date: data?.results_announcement_date || null,
    submissions_open: data?.submissions_open ?? true,
  });
}
