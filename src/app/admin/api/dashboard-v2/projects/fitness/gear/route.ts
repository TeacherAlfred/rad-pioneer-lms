import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/require-admin';

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('fitness_gear').select('*').order('total_distance_m', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gear: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, retired, mileage_alert_threshold_m } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof retired === 'boolean') update.retired = retired;
  if (typeof mileage_alert_threshold_m === 'number') update.mileage_alert_threshold_m = mileage_alert_threshold_m;

  const sb = supabaseAdmin();
  const { data, error } = await sb.from('fitness_gear').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gear: data });
}
