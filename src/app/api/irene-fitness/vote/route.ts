import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const VOTE_CATEGORIES = ['funniest', 'most_inspiring', 'mad_scientist'] as const;
type VoteCategory = (typeof VOTE_CATEGORIES)[number];

// Casts one anonymous, device-scoped vote. Every gate here is server-side on
// purpose - the public page also checks phase/consent client-side for UX,
// but none of that can be trusted, so it's re-checked against the DB before
// the insert is attempted.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { response_id, category, voter_device_id } = body as {
    response_id?: string;
    category?: string;
    voter_device_id?: string;
  };

  if (!response_id || typeof response_id !== 'string') {
    return NextResponse.json({ error: 'response_id is required' }, { status: 400 });
  }
  if (!category || !VOTE_CATEGORIES.includes(category as VoteCategory)) {
    return NextResponse.json({ error: `category must be one of: ${VOTE_CATEGORIES.join(', ')}` }, { status: 400 });
  }
  if (!voter_device_id || typeof voter_device_id !== 'string' || voter_device_id.length > 64) {
    return NextResponse.json({ error: 'voter_device_id is required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: settings, error: settingsError } = await supabase
    .from('irene_fitness_voting_settings')
    .select('phase')
    .eq('id', 1)
    .single();
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  if (settings?.phase !== 'open') {
    return NextResponse.json({ error: 'Voting is not open right now' }, { status: 403 });
  }

  const { data: response, error: responseError } = await supabase
    .from('irene_fitness_responses')
    .select('id, family_id, irene_fitness_families!inner(consent_public_display)')
    .eq('id', response_id)
    .single();
  if (responseError || !response) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }
  const family = response.irene_fitness_families as unknown as { consent_public_display: boolean };
  if (!family?.consent_public_display) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const { error: insertError } = await supabase
    .from('irene_fitness_votes')
    .insert({ response_id, category, voter_device_id });

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      return NextResponse.json({ already_voted: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
