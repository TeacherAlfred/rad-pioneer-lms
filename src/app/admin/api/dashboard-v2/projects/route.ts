import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// First project summary on this tab: Irene Primary Fitness Community
// (irene_fitness_* tables). More projects get their own key alongside
// irene_fitness as they come online.
//
// Also returns `rows`, the per-family detail list backing the drill-down
// view at /admin/dashboard-v2/projects/irene-fitness - one request serves
// both the summary tiles and the detail table so they can't drift apart.
export async function GET() {
  const supabase = supabaseAdmin();

  const [
    { data: families, error: familiesError },
    { data: responses, error: responsesError },
    { data: children, error: childrenError },
  ] = await Promise.all([
    supabase
      .from('irene_fitness_families')
      .select('id, whatsapp, email, consent_public_display, consent_updates, consent_marketing, created_at'),
    supabase.from('irene_fitness_responses').select('id, family_id, display_name'),
    supabase.from('irene_fitness_children').select('family_id, grade, class'),
  ]);
  if (familiesError) return NextResponse.json({ error: familiesError.message }, { status: 500 });
  if (responsesError) return NextResponse.json({ error: responsesError.message }, { status: 500 });
  if (childrenError) return NextResponse.json({ error: childrenError.message }, { status: 500 });

  const responseByFamily = new Map((responses || []).map((r) => [r.family_id, r]));
  const childrenByFamily = new Map<string, { grade: string; class: string | null }[]>();
  (children || []).forEach((c) => {
    const list = childrenByFamily.get(c.family_id) || [];
    list.push({ grade: c.grade, class: c.class });
    childrenByFamily.set(c.family_id, list);
  });

  const rows = (families || [])
    .map((f) => ({
      family_id: f.id,
      display_name: responseByFamily.get(f.id)?.display_name || '(no response yet)',
      whatsapp: f.whatsapp,
      email: f.email,
      consent_public_display: !!f.consent_public_display,
      consent_updates: !!f.consent_updates,
      consent_marketing: !!f.consent_marketing,
      created_at: f.created_at,
      children: childrenByFamily.get(f.id) || [],
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    irene_fitness: {
      summary: {
        total_responses: responses?.length || 0,
        total_children: children?.length || 0,
        consent_public_display: rows.filter((r) => r.consent_public_display).length,
        consent_updates: rows.filter((r) => r.consent_updates).length,
        consent_marketing: rows.filter((r) => r.consent_marketing).length,
        whatsapp_provided: rows.filter((r) => r.whatsapp).length,
        email_provided: rows.filter((r) => r.email).length,
      },
      rows,
    },
  });
}
