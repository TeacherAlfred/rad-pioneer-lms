import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FAMILY_COOKIE = 'irene_fitness_family';

// Returning-visitor prefill (spec §7.3): reads the family_session cookie set
// on a prior successful submit and returns just enough to skip Step 1 and
// pre-fill Step 2. Never accepts a family id from anywhere but this cookie.
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
    .select('id, whatsapp, email')
    .eq('id', familyId)
    .single();

  if (!family) {
    return NextResponse.json({ family: null });
  }

  const [{ data: response }, { data: children }] = await Promise.all([
    supabase.from('irene_fitness_responses').select('display_name').eq('family_id', family.id).single(),
    supabase.from('irene_fitness_children').select('grade, class').eq('family_id', family.id),
  ]);

  return NextResponse.json({
    family: {
      whatsapp: family.whatsapp,
      email: family.email,
      display_name: response?.display_name || '',
      children: children || [],
    },
  });
}
