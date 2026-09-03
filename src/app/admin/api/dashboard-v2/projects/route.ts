import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

// Teaser stat for bespoke sub-apps that have their own tables (e.g. Irene
// Fitness). Add a case here when a project gets its own dedicated build -
// generic (no-href) projects just show their checklist progress instead,
// computed inline in GET below.
async function teaserFor(supabase: ReturnType<typeof supabaseAdmin>, key: string): Promise<{ teaser_label: string | null; teaser_value: number | null }> {
  switch (key) {
    case 'irene-fitness': {
      const { count } = await supabase
        .from('irene_fitness_responses')
        .select('id', { count: 'exact', head: true });
      return { teaser_label: 'Responses', teaser_value: count || 0 };
    }
    default:
      return { teaser_label: null, teaser_value: null };
  }
}

export async function GET() {
  const supabase = supabaseAdmin();

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, key, name, description, stage, category, status, href, locked, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: checklistCounts } = await supabase
    .from('project_checklist_items')
    .select('project_id, done');

  const checklistByProject = new Map<string, { done: number; total: number }>();
  for (const row of checklistCounts || []) {
    const entry = checklistByProject.get(row.project_id) || { done: 0, total: 0 };
    entry.total += 1;
    if (row.done) entry.done += 1;
    checklistByProject.set(row.project_id, entry);
  }

  const ideas = (projects || []).filter((p) => p.stage === 'idea');
  const active = (projects || []).filter((p) => p.stage === 'active');

  const activeWithTeasers = await Promise.all(
    active.map(async (p) => ({ ...p, ...(await teaserFor(supabase, p.key)), checklist: checklistByProject.get(p.id) || null }))
  );
  const ideasWithChecklist = ideas.map((p) => ({ ...p, checklist: checklistByProject.get(p.id) || null }));

  return NextResponse.json({ ideas: ideasWithChecklist, projects: activeWithTeasers });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('projects')
    .insert({ key, name, description: body.description || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
