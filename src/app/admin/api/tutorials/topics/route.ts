import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin view needs every topic (regardless of is_hidden, unlike the public
// route) plus the vote count AND the opted-in phone numbers per topic -
// collecting those numbers is pointless if nobody can ever see them to
// actually notify someone when a topic launches.
export async function GET() {
  const [{ data: topics, error: topicsError }, { data: votes, error: votesError }] = await Promise.all([
    supabaseAdmin.from('tutorial_topic_suggestions').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin.from('tutorial_topic_votes').select('topic_id, phone, created_at'),
  ]);
  if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
  if (votesError) return NextResponse.json({ error: votesError.message }, { status: 500 });

  const votesByTopic = new Map<string, { phone: string; created_at: string }[]>();
  for (const v of votes || []) {
    const list = votesByTopic.get(v.topic_id) || [];
    if (v.phone) list.push({ phone: v.phone, created_at: v.created_at });
    votesByTopic.set(v.topic_id, list);
  }

  const rows = (topics || []).map(t => ({
    ...t,
    vote_count: (votes || []).filter(v => v.topic_id === t.id).length,
    interested_phones: votesByTopic.get(t.id) || [],
  }));

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, sort_order } = body;
    if (!title || !String(title).trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('tutorial_topic_suggestions')
      .insert([{ title: String(title).trim(), sort_order: sort_order === undefined ? 0 : Number(sort_order) }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { title, sort_order, is_hidden } = body;
    const update: Record<string, any> = {};
    if (title !== undefined) update.title = String(title).trim();
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (is_hidden !== undefined) update.is_hidden = !!is_hidden;

    const { data, error } = await supabaseAdmin.from('tutorial_topic_suggestions').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('tutorial_topic_suggestions').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
