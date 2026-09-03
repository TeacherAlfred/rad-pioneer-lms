import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('fitness_manual_logs').select('*').order('log_date', { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { log_date, weight_kg, energy_level, sleep_hours, soreness_notes, life_event_tag, free_notes } = body ?? {};

  if (!log_date) {
    return NextResponse.json({ error: 'log_date is required' }, { status: 400 });
  }
  if (energy_level != null && (energy_level < 1 || energy_level > 5)) {
    return NextResponse.json({ error: 'energy_level must be between 1 and 5' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('fitness_manual_logs')
    .upsert(
      {
        log_date,
        weight_kg: weight_kg ?? null,
        energy_level: energy_level ?? null,
        sleep_hours: sleep_hours ?? null,
        soreness_notes: soreness_notes ?? null,
        life_event_tag: life_event_tag ?? null,
        free_notes: free_notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'log_date' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, log: data });
}
