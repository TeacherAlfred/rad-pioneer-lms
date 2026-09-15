import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Singleton row (see migration 20260915100000_tutorial_topic_vote_settings.sql)
// - always exactly one, so GET/PATCH both operate on "whichever row exists"
// rather than taking an id.
export async function GET() {
  const { data, error } = await supabaseAdmin.from('tutorial_topic_vote_settings').select('*').limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { reveal_threshold, min_display_threshold } = body;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (reveal_threshold !== undefined) {
      const n = Number(reveal_threshold);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'reveal_threshold must be a non-negative number' }, { status: 400 });
      update.reveal_threshold = n;
    }
    if (min_display_threshold !== undefined) {
      const n = Number(min_display_threshold);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'min_display_threshold must be a non-negative number' }, { status: 400 });
      update.min_display_threshold = n;
    }

    const { data: existing } = await supabaseAdmin.from('tutorial_topic_vote_settings').select('id').limit(1).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Settings row not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin.from('tutorial_topic_vote_settings').update(update).eq('id', existing.id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
