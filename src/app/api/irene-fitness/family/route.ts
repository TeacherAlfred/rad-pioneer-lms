import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FAMILY_COOKIE = 'irene_fitness_family';

// Returning-visitor prefill (spec §7.3): reads the family_session cookie set
// on a prior successful submit and returns just enough to skip Step 1 and
// pre-fill Step 2 (and the Tell Your Story step, if they'd answered any of
// it before). Never accepts a family id from anywhere but this cookie.
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const familyId = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${FAMILY_COOKIE}=`))
    ?.split('=')[1];

  if (!familyId) {
    return NextResponse.json({ family: null });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: family } = await supabase
    .from('irene_fitness_families')
    .select('id, whatsapp, email, consent_updates, consent_marketing')
    .eq('id', familyId)
    .single();

  if (!family) {
    return NextResponse.json({ family: null });
  }

  const [{ data: response }, { data: children }] = await Promise.all([
    supabase.from('irene_fitness_responses').select('id, display_name').eq('family_id', family.id).single(),
    supabase.from('irene_fitness_children').select('grade, class').eq('family_id', family.id),
  ]);

  let story = null;
  if (response) {
    const { data } = await supabase
      .from('irene_fitness_response_story')
      .select(
        'motivation, club_member, club_names, shoe_count, boss_level_challenge_2026, toughest_challenge, proudest_moment, weirdest_fuel, funniest_fail'
      )
      .eq('response_id', response.id)
      .single();
    story = data || null;
  }

  return NextResponse.json({
    family: {
      whatsapp: family.whatsapp,
      email: family.email,
      consent_updates: !!family.consent_updates,
      consent_marketing: !!family.consent_marketing,
      response_id: response?.id || null,
      display_name: response?.display_name || '',
      children: children || [],
      story,
    },
  });
}
