import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Single implicit row - this app has one admin (ADMIN_PHONE_NUMBER), no
// multi-user settings model anywhere else. Created lazily on first GET
// rather than seeded in the migration, so there's exactly one place that
// decides the defaults.
async function getOrCreateSettings() {
  const { data: existing } = await supabaseAdmin.from('admin_notification_settings').select('*').limit(1).maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabaseAdmin.from('admin_notification_settings').insert([{}]).select().single();
  if (error) throw error;
  return created;
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { buffer_minutes, dnd_enabled, dnd_start_time, dnd_end_time } = body;

    if (buffer_minutes !== undefined && (!Number.isInteger(buffer_minutes) || buffer_minutes < 1 || buffer_minutes > 180)) {
      return NextResponse.json({ error: 'buffer_minutes must be a whole number between 1 and 180' }, { status: 400 });
    }
    if (dnd_start_time !== undefined && dnd_start_time !== null && !isValidTime(dnd_start_time)) {
      return NextResponse.json({ error: 'dnd_start_time must be in HH:MM format' }, { status: 400 });
    }
    if (dnd_end_time !== undefined && dnd_end_time !== null && !isValidTime(dnd_end_time)) {
      return NextResponse.json({ error: 'dnd_end_time must be in HH:MM format' }, { status: 400 });
    }
    if (dnd_enabled === true && (!dnd_start_time || !dnd_end_time)) {
      return NextResponse.json({ error: 'dnd_start_time and dnd_end_time are required to enable Do Not Disturb' }, { status: 400 });
    }

    const existing = await getOrCreateSettings();

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (buffer_minutes !== undefined) update.buffer_minutes = buffer_minutes;
    if (dnd_enabled !== undefined) update.dnd_enabled = !!dnd_enabled;
    if (dnd_start_time !== undefined) update.dnd_start_time = dnd_start_time;
    if (dnd_end_time !== undefined) update.dnd_end_time = dnd_end_time;

    const { data, error } = await supabaseAdmin
      .from('admin_notification_settings')
      .update(update)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
