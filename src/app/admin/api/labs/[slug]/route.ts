import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SEED_LABS } from '@/content/labs';
import type { LabContent } from '@/content/labs/types';
import { validateLabContent } from '@/lib/labContentValidate';
import { loadPublishedLabs } from '@/lib/labsRepo';
import { adminEmail } from '@/lib/adminIdentity';

// In-place editor backend for one lab (/admin/labs/[slug]).
//   GET                         -> the working copy (draft ?? live ?? seed) + status
//   PUT { action: 'save' }      -> store as draft (allowed with warnings)
//   PUT { action: 'publish' }   -> validate strictly, make it live, revalidate
//   PUT { action: 'discard' }   -> drop the draft, back to what's live

type Params = { params: Promise<{ slug: string }> };

async function readRow(slug: string) {
  const { data, error } = await supabaseAdmin()
    .from('labs')
    .select('slug, content, draft_content, published_at, updated_at, updated_by')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as { slug: string; content: LabContent | null; draft_content: LabContent | null; published_at: string | null; updated_at: string; updated_by: string | null } | null;
}

function statusOf(row: Awaited<ReturnType<typeof readRow>>, seed?: LabContent) {
  return {
    isLive: !!row?.content || (!row && !!seed),
    hasDraft: !!row?.draft_content,
    fromSeed: !row && !!seed,
    publishedAt: row?.published_at ?? null,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  try {
    const [row, allLabs] = await Promise.all([readRow(slug), loadPublishedLabs()]);
    const seed = SEED_LABS.find(l => l.slug === slug);
    const lab = row?.draft_content || row?.content || seed;
    if (!lab) return NextResponse.json({ error: 'Lab not found.' }, { status: 404 });
    return NextResponse.json({
      lab: { ...lab, slug },
      status: statusOf(row, seed),
      allLabs: allLabs.filter(l => l.slug !== slug),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load lab.' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as 'save' | 'publish' | 'discard';
  const sb = supabaseAdmin();
  const by = await adminEmail();
  const now = new Date().toISOString();

  try {
    const row = await readRow(slug);
    const seed = SEED_LABS.find(l => l.slug === slug);
    if (!row && !seed) return NextResponse.json({ error: 'Lab not found.' }, { status: 404 });

    if (action === 'discard') {
      if (!row?.draft_content) return NextResponse.json({ error: 'There is no draft to discard.' }, { status: 400 });
      if (!row.content) {
        // Never published. For a seed lab, dropping the row just falls back
        // to the seed; an admin-created lab would be deleted outright, which
        // is too destructive for a "discard changes" button.
        if (!seed) return NextResponse.json({ error: 'This lab has never been published, so its draft is the only copy. Edit it instead.' }, { status: 400 });
        await sb.from('labs').delete().eq('slug', slug);
      } else {
        await sb.from('labs').update({ draft_content: null, updated_at: now, updated_by: by }).eq('slug', slug);
      }
      const fresh = await readRow(slug);
      return NextResponse.json({ ok: true, lab: fresh?.content || seed, status: statusOf(fresh, seed) });
    }

    if (action !== 'save' && action !== 'publish') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

    const { lab, errors } = validateLabContent(body.content, slug);

    if (action === 'publish' && errors.length) {
      return NextResponse.json({ error: 'Fix these before publishing:', errors }, { status: 422 });
    }

    const patch = action === 'publish'
      ? { content: lab, draft_content: null, published_at: now, updated_at: now, updated_by: by }
      : { draft_content: lab, updated_at: now, updated_by: by };

    const { error } = row
      ? await sb.from('labs').update(patch).eq('slug', slug)
      : await sb.from('labs').insert([{ slug, ...patch }]);
    if (error) throw error;

    // Neighbouring labs' prev/next + topic grid change too, so refresh
    // every lab page, not just this one.
    if (action === 'publish') revalidatePath('/labs/[slug]', 'page');

    const fresh = await readRow(slug);
    return NextResponse.json({ ok: true, warnings: errors, status: statusOf(fresh, seed) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Save failed.' }, { status: 500 });
  }
}
