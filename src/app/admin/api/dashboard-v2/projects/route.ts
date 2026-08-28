import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Lightweight teaser list for the Projects hub (/admin/dashboard-v2/projects)
// - each project's full dashboard lives on its own route and its own API
// (see /admin/api/dashboard-v2/projects/irene-fitness), this endpoint just
// feeds the picker cards. Add a project by adding an entry to PROJECTS and
// a case in the switch below.
const PROJECTS = [
  { key: 'irene-fitness', name: 'Irene Primary Fitness Community', href: '/admin/dashboard-v2/projects/irene-fitness' },
] as const;

export async function GET() {
  const supabase = supabaseAdmin();

  const cards = await Promise.all(
    PROJECTS.map(async (p) => {
      switch (p.key) {
        case 'irene-fitness': {
          const { count } = await supabase
            .from('irene_fitness_responses')
            .select('id', { count: 'exact', head: true });
          return { ...p, teaser_label: 'Responses', teaser_value: count || 0 };
        }
        default:
          return { ...p, teaser_label: null, teaser_value: null };
      }
    })
  );

  return NextResponse.json({ projects: cards });
}
