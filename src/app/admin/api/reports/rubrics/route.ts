import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Edit a rubric descriptor's wording in place. Safe for old reports: every
// revision snapshots the descriptor text it showed (content.assessed), so
// only drafts generated after this change pick up the new wording.
export async function PATCH(req: Request) {
  const body = (await req.json()) as { areaId?: unknown; levelId?: unknown; text?: unknown };
  if (typeof body.areaId !== 'string' || typeof body.levelId !== 'string' || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'areaId, levelId and text are required' }, { status: 400 });
  }
  const { error } = await supabaseAdmin()
    .from('rubric_descriptors')
    .upsert({ area_id: body.areaId, level_id: body.levelId, text: body.text.trim().slice(0, 200) }, { onConflict: 'area_id,level_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
