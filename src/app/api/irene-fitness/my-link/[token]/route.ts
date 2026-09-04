import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public lookup behind a family's durable "my link"
// (/projects/irene-fitness/me/[token]) - just enough to render the chooser
// (edit vs. share for votes), never the story content itself (that only
// loads once "Edit our response" primes the real cookie-authenticated
// flow, same as api/irene-fitness/family already does for a returning
// visitor).
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = supabaseAdmin();

  const { data: family, error: familyError } = await supabase
    .from('irene_fitness_families')
    .select('id')
    .eq('access_token', token)
    .maybeSingle();
  if (familyError) return NextResponse.json({ error: familyError.message }, { status: 500 });
  if (!family) return NextResponse.json({ found: false });

  const { data: response, error: responseError } = await supabase
    .from('irene_fitness_responses')
    .select('id, display_name')
    .eq('family_id', family.id)
    .maybeSingle();
  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  return NextResponse.json({
    found: true,
    display_name: response?.display_name || null,
    response_id: response?.id || null,
  });
}
