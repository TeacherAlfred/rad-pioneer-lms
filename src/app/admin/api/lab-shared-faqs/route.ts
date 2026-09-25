import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { defaultSharedFaqs, GLOBAL_FAQ_KEY, SERIES } from '@/content/labs';
import type { Faq } from '@/content/labs/types';
import { adminEmail } from '@/lib/adminIdentity';

// Shared RAD Lab FAQs ("Shared FAQs" panel on /admin/labs). Kept off the
// /admin/api/labs/[slug] path so a lab can never be slugged into it.
//   GET            -> every bucket ('global' + each series) with its live items
//   PUT {key,items} -> replace that bucket and refresh every lab page

const BUCKETS = [
  { key: GLOBAL_FAQ_KEY, label: 'All labs', hint: 'Shown on every lab, under "About RAD Labs".' },
  ...SERIES.map(s => ({ key: s.key, label: `${s.name} series`, hint: `Shown on every ${s.name} lab.` })),
];

export async function GET() {
  const { data, error } = await supabaseAdmin().from('lab_shared_faqs').select('key, items, updated_at, updated_by');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const defaults = defaultSharedFaqs();
  const rows = new Map((data || []).map(r => [r.key as string, r]));
  return NextResponse.json({
    buckets: BUCKETS.map(b => {
      const row = rows.get(b.key);
      return {
        ...b,
        items: (row ? row.items : defaults[b.key] || []) as Faq[],
        saved: !!row,
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
      };
    }),
  });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const key = String(body.key || '');
  if (!BUCKETS.some(b => b.key === key)) return NextResponse.json({ error: 'Unknown FAQ group.' }, { status: 400 });

  const raw: unknown[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const items: Faq[] = raw.map(x => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return {
      q: typeof o.q === 'string' ? o.q.trim().slice(0, 200) : '',
      a: typeof o.a === 'string' ? o.a.trim().slice(0, 1500) : '',
    };
  });
  const incomplete = items.map((f, i) => (!f.q || !f.a ? i + 1 : 0)).filter(Boolean);
  if (incomplete.length) {
    return NextResponse.json({ error: `Question${incomplete.length > 1 ? 's' : ''} ${incomplete.join(', ')} need${incomplete.length > 1 ? '' : 's'} both a question and an answer.` }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from('lab_shared_faqs')
    .upsert({ key, items, updated_at: now, updated_by: await adminEmail() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath('/labs/[slug]', 'page');
  return NextResponse.json({ ok: true, updatedAt: now });
}
