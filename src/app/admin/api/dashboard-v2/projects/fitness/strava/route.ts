import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';
import { disconnectStrava } from '@/lib/fitness/strava';

export async function GET() {
  const sb = supabaseAdmin();
  const { data: token, error } = await sb
    .from('fitness_oauth_tokens')
    .select('athlete_id, connected_at')
    .eq('provider', 'strava')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: lastActivity } = await sb
    .from('fitness_activities')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    connected: !!token,
    athlete_id: token?.athlete_id ?? null,
    connected_at: token?.connected_at ?? null,
    last_synced_at: lastActivity?.synced_at ?? null,
  });
}

export async function DELETE() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await disconnectStrava();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to disconnect' }, { status: 500 });
  }
}
