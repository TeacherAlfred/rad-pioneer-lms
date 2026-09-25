import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { blankLab, getSeries, SEED_LABS, SLUG_PATTERN } from '@/content/labs';
import type { LabContent } from '@/content/labs/types';
import { adminEmail } from '@/lib/adminIdentity';

// Admin list + create for RAD Labs (/admin/labs). Behind the /admin
// middleware allowlist like every /admin/api route.

type ListItem = {
  slug: string;
  title: string;
  seriesKey: string;
  labNumber: number;
  state: 'live' | 'live_with_draft' | 'draft_only' | 'seed';
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('labs')
    .select('slug, content, draft_content, updated_at, updated_by');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = new Map<string, ListItem>();
  for (const seed of SEED_LABS) {
    items.set(seed.slug, { slug: seed.slug, title: seed.title, seriesKey: seed.seriesKey, labNumber: seed.labNumber, state: 'seed', updatedAt: null, updatedBy: null });
  }
  for (const row of data || []) {
    const c = (row.draft_content || row.content) as LabContent;
    items.set(row.slug, {
      slug: row.slug,
      title: c.title,
      seriesKey: c.seriesKey,
      labNumber: c.labNumber,
      state: row.content ? (row.draft_content ? 'live_with_draft' : 'live') : 'draft_only',
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  }
  const rows = Array.from(items.values()).sort((a, b) => a.seriesKey.localeCompare(b.seriesKey) || a.labNumber - b.labNumber);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const seriesKey = String(body.seriesKey || '');
  const labNumber = Math.round(Number(body.labNumber));
  const title = String(body.title || '').trim().slice(0, 120);
  const slug = String(body.slug || `${seriesKey}-${String(labNumber).padStart(2, '0')}`).trim().toLowerCase();

  if (!getSeries(seriesKey)) return NextResponse.json({ error: 'Pick a series.' }, { status: 400 });
  if (!Number.isInteger(labNumber) || labNumber < 1) return NextResponse.json({ error: 'Lab number must be 1 or more.' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Give the lab a working title.' }, { status: 400 });
  if (!SLUG_PATTERN.test(slug)) return NextResponse.json({ error: 'The address can only use lowercase letters, numbers and dashes.' }, { status: 400 });
  if (SEED_LABS.some(l => l.slug === slug)) return NextResponse.json({ error: `A lab called "${slug}" already exists.` }, { status: 409 });

  const { error } = await supabaseAdmin().from('labs').insert([{
    slug,
    draft_content: blankLab(slug, seriesKey, labNumber, title),
    updated_by: await adminEmail(),
  }]);
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? `A lab called "${slug}" already exists.` : error.message }, { status });
  }
  return NextResponse.json({ ok: true, slug });
}
