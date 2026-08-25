import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Public - powers the tiered package picker step in RegisterInterestModal.
// Returns published event_packages for this featured_program plus any
// globally-available ones (featured_program_id null, e.g. Priority
// Coaching - spec §9.4, location-flexible by design).
export async function GET(request: Request) {
  const programId = new URL(request.url).searchParams.get('program_id');
  if (!programId) return NextResponse.json({ error: 'program_id is required' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('event_packages')
    .select('id, tier_role, display_order, final_fee, display_name, display_description, package:packages(id, name, event_type, description, child_facing_blurb)')
    .eq('published', true)
    .or(`featured_program_id.eq.${programId},featured_program_id.is.null`)
    .order('display_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve the per-attachment name/description override here, server-side,
  // so the same package can be attached twice (e.g. "Single Workshop" ×1
  // and "Multi-Workshop Pass" ×3) without the client needing to know about
  // the override mechanism at all - it just gets two distinctly-labeled rows.
  const rows = (data || []).map((row: any) => ({
    ...row,
    package: {
      ...row.package,
      name: row.display_name || row.package.name,
      description: row.display_description || row.package.description,
    },
  }));

  return NextResponse.json({ rows });
}
