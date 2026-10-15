import { NextResponse } from 'next/server';
import { adminEmail } from '@/lib/adminIdentity';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { unknownPlaceholders } from '@/lib/reports/generate';
import { loadRubrics, loadTemplates } from '@/lib/reports/server';
import type { Condition, ConditionOp, NarrativeTemplate, TemplateSection } from '@/lib/reports/types';
import { SECTION_FIELDS } from '@/lib/reports/types';

const SECTIONS: TemplateSection[] = ['strength', 'growth', 'learner_note', 'whats_next'];
const OPS: ConditionOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'];

export async function GET() {
  try {
    const [templates, rubrics] = await Promise.all([loadTemplates({ includeInactive: true }), loadRubrics()]);
    return NextResponse.json({ templates, rubrics });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function validate(body: Record<string, unknown>): { error: string } | { row: Omit<NarrativeTemplate, 'id' | 'version' | 'is_active' | 'created_at' | 'created_by'> } {
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(key)) return { error: 'Key must look like "strength.debugging" (lowercase, one dot).' };
  const section = body.section as TemplateSection;
  if (!SECTIONS.includes(section)) return { error: 'Unknown section.' };
  if (!key.startsWith(`${section}.`)) return { error: `Key must start with "${section}."` };
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : key;
  const priority = typeof body.priority === 'number' && Number.isInteger(body.priority) ? body.priority : 100;

  const rawFields = (body.fields && typeof body.fields === 'object' ? body.fields : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const f of SECTION_FIELDS[section]) {
    const v = typeof rawFields[f.key] === 'string' ? (rawFields[f.key] as string) : '';
    const bad = unknownPlaceholders(v);
    if (bad.length) return { error: `${f.label} uses unknown placeholder {{${bad[0]}}}.` };
    fields[f.key] = v;
  }
  if (!Object.values(fields).some(v => v.trim())) return { error: 'Template has no wording.' };

  const rawCond = (body.conditions && typeof body.conditions === 'object' ? body.conditions : {}) as { all?: unknown; area?: unknown };
  if (!Array.isArray(rawCond.all)) return { error: 'conditions.all must be a list.' };
  const all: Condition[] = [];
  for (const c of rawCond.all as Record<string, unknown>[]) {
    if (typeof c?.fact !== 'string' || !OPS.includes(c.op as ConditionOp)) return { error: 'Each condition needs a fact and a valid op.' };
    all.push({ fact: c.fact, op: c.op as ConditionOp, value: c.value as Condition['value'] });
  }
  const area = typeof rawCond.area === 'string' && rawCond.area.trim() ? rawCond.area.trim() : undefined;
  return { row: { key, section, label, priority, fields, conditions: area ? { all, area } : { all } } };
}

// Save = new version of the key. The previous active version is
// deactivated; reports keep the template_version they were built from.
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const v = validate(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const db = supabaseAdmin();
  const { data: last } = await db.from('narrative_templates').select('version').eq('key', v.row.key).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = ((last as { version: number } | null)?.version ?? 0) + 1;
  await db.from('narrative_templates').update({ is_active: false }).eq('key', v.row.key).eq('is_active', true);
  const { data, error } = await db
    .from('narrative_templates')
    .insert({ ...v.row, version, is_active: true, created_by: await adminEmail() })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

// Retire a template key (deactivate every version). Existing reports are
// untouched; new drafts stop using it.
export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
  const { error } = await supabaseAdmin().from('narrative_templates').update({ is_active: false }).eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
