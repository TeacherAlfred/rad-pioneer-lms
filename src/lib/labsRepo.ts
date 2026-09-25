import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SEED_LABS } from '@/content/labs';
import type { LabContent } from '@/content/labs/types';

// Where lab content comes from. A `labs` row (edited at /admin/labs/[slug])
// wins over the TS seed with the same slug; seeds with no row are served
// as-is, so the site keeps working if the table is empty or unreachable.
//
// `content` is what's live; `draft_content` is the admin's unpublished
// working copy and never reaches the public page.

export type LabRow = {
  slug: string;
  content: LabContent | null;
  draft_content: LabContent | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export const fetchLabRows = cache(async (): Promise<LabRow[] | null> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data, error } = await supabaseAdmin()
      .from('labs')
      .select('slug, content, draft_content, published_at, updated_at, updated_by');
    if (error) throw error;
    return (data || []) as LabRow[];
  } catch (e) {
    console.error('[labsRepo] falling back to seed labs:', e);
    return null;
  }
});

// Every lab that's live on the public site.
export const loadPublishedLabs = cache(async (): Promise<LabContent[]> => {
  const rows = (await fetchLabRows()) || [];
  const bySlug = new Map<string, LabContent>(SEED_LABS.map(l => [l.slug, l]));
  for (const row of rows) {
    // A row with no published content yet (a brand-new admin lab, or a
    // seed lab only ever saved as a draft) doesn't change what's live.
    if (row.content) bySlug.set(row.slug, { ...row.content, slug: row.slug });
  }
  return Array.from(bySlug.values());
});

export async function getPublishedLab(slug: string): Promise<LabContent | undefined> {
  return (await loadPublishedLabs()).find(l => l.slug === slug);
}
