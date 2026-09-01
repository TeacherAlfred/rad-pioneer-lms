import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Reconciles a device's "already voted today" state against the DB rather
// than trusting localStorage alone - self-heals after the daily SAST reset
// (irene_fitness_votes.vote_date) or if a device's storage was cleared,
// same reasoning as the old irene-comrades platform's tapped-key sync.
function sastDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('device_id');
  if (!deviceId) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  // One query, sliced two ways: today's rows drive each vote button's
  // filled/open state (the daily-reset rule), while the full, all-time set
  // of response_ids drives the New to you / Your favourites feed filter -
  // "have I ever voted on this card at all," independent of date.
  const { data, error } = await supabase
    .from('irene_fitness_votes')
    .select('response_id, category, vote_date')
    .eq('voter_device_id', deviceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = sastDateString();
  const rows = data || [];
  const votes = rows.filter((v) => v.vote_date === today).map((v) => ({ response_id: v.response_id, category: v.category }));
  const everResponseIds = [...new Set(rows.map((v) => v.response_id))];

  return NextResponse.json({ votes, ever_response_ids: everResponseIds });
}
