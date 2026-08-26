import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// First project summary on this tab: Irene Primary Fitness Community
// (irene_fitness_* tables). More projects get their own key alongside
// irene_fitness as they come online.
export async function GET() {
  const supabase = supabaseAdmin();

  const [
    { data: responses, error: responsesError },
    { data: families, error: familiesError },
    { data: children, error: childrenError },
  ] = await Promise.all([
    supabase.from('irene_fitness_responses').select('id'),
    supabase
      .from('irene_fitness_families')
      .select('whatsapp, email, consent_public_display, consent_updates, consent_marketing'),
    supabase.from('irene_fitness_children').select('id'),
  ]);
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });
  if (familiesError) return NextResponse.json({ error: familiesError.message }, { status: 500 });
  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 });

  return NextResponse.json({
    irene_fitness: {
      total_responses: responses?.length || 0,
      total_children: children?.length || 0,
      consent_public_display: families?.filter((f) => f.consent_public_display).length || 0,
      consent_updates: families?.filter((f) => f.consent_updates).length || 0,
      consent_marketing: families?.filter((f) => f.consent_marketing).length || 0,
      whatsapp_provided: families?.filter((f) => f.whatsapp).length || 0,
      email_provided: families?.filter((f) => f.email).length || 0,
    },
  });
}
