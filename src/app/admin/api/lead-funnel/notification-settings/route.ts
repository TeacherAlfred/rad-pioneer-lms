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

// admin_dnd_schedule always has exactly 7 rows (seeded by its migration,
// one per day of week) - unlike settings, nothing to lazily create here.
async function getDndSchedule() {
  const { data, error } = await supabaseAdmin.from('admin_dnd_schedule').select('*').order('day_of_week');
  if (error) throw error;
  return data || [];
}

export async function GET() {
  try {
    const [settings, dndSchedule] = await Promise.all([getOrCreateSettings(), getDndSchedule()]);
    return NextResponse.json({ settings, dndSchedule });
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
    const { buffer_minutes, dndSchedule } = body;

    if (buffer_minutes !== undefined && (!Number.isInteger(buffer_minutes) || buffer_minutes < 1 || buffer_minutes > 180)) {
      return NextResponse.json({ error: 'buffer_minutes must be a whole number between 1 and 180' }, { status: 400 });
    }

    if (dndSchedule !== undefined) {
      if (!Array.isArray(dndSchedule)) {
        return NextResponse.json({ error: 'dndSchedule must be an array' }, { status: 400 });
      }
      for (const day of dndSchedule) {
        if (!Number.isInteger(day.day_of_week) || day.day_of_week < 0 || day.day_of_week > 6) {
          return NextResponse.json({ error: 'Each dndSchedule entry needs a day_of_week between 0 and 6' }, { status: 400 });
        }
        if (day.start_time !== null && day.start_time !== undefined && !isValidTime(day.start_time)) {
          return NextResponse.json({ error: `Day ${day.day_of_week}: start_time must be in HH:MM format` }, { status: 400 });
        }
        if (day.end_time !== null && day.end_time !== undefined && !isValidTime(day.end_time)) {
          return NextResponse.json({ error: `Day ${day.day_of_week}: end_time must be in HH:MM format` }, { status: 400 });
        }
        if (day.enabled && (!day.start_time || !day.end_time)) {
          return NextResponse.json({ error: `Day ${day.day_of_week}: start_time and end_time are required to enable Do Not Disturb` }, { status: 400 });
        }
      }
    }

    if (buffer_minutes !== undefined) {
      const existing = await getOrCreateSettings();
      const { error } = await supabaseAdmin
        .from('admin_notification_settings')
        .update({ buffer_minutes, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }

    if (dndSchedule !== undefined) {
      // Upsert on day_of_week (unique) - the migration guarantees all 7
      // rows already exist, so every PATCH here is really an update, but
      // upsert keeps this safe even if a row were ever missing.
      const { error } = await supabaseAdmin.from('admin_dnd_schedule').upsert(
        dndSchedule.map((d: any) => ({
          day_of_week: d.day_of_week,
          enabled: !!d.enabled,
          start_time: d.start_time || null,
          end_time: d.end_time || null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'day_of_week' }
      );
      if (error) throw error;
    }

    const [settings, schedule] = await Promise.all([getOrCreateSettings(), getDndSchedule()]);
    return NextResponse.json({ settings, dndSchedule: schedule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
