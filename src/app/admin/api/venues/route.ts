import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VENUE_TYPES } from '@/lib/programs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Follows a (possibly shortened, e.g. maps.app.goo.gl) Google Maps link
// to its resolved URL and pulls coordinates out of the `!3d..!4d..`
// marker pair (preferred - the actual pin) or the `@lat,lng,zoom`
// viewport pair (fallback). Best-effort: returns nulls rather than
// throwing if the link doesn't resolve or isn't a Maps URL, so a venue
// can still be saved without coordinates.
async function resolveMapsCoordinates(mapsUrl: string): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const res = await fetch(mapsUrl, { redirect: 'follow' });
    const finalUrl = res.url || mapsUrl;
    const pin = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pin) return { latitude: Number(pin[1]), longitude: Number(pin[2]) };
    const viewport = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (viewport) return { latitude: Number(viewport[1]), longitude: Number(viewport[2]) };
    return { latitude: null, longitude: null };
  } catch {
    return { latitude: null, longitude: null };
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin.from('venues').select('*').order('type').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, type, address, notes, active } = body;
    let { latitude, longitude } = body;
    const mapsUrl = body.maps_url;

    if (!name || !String(name).trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (type !== undefined && !VENUE_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${VENUE_TYPES.join(', ')}` }, { status: 400 });
    }

    // Auto-resolve coordinates from a pasted Maps link if none were typed in by hand.
    if (mapsUrl && (latitude === undefined || latitude === '' || latitude === null) && (longitude === undefined || longitude === '' || longitude === null)) {
      const resolved = await resolveMapsCoordinates(mapsUrl);
      latitude = resolved.latitude;
      longitude = resolved.longitude;
    }

    const { data, error } = await supabaseAdmin
      .from('venues')
      .insert([{
        name: String(name).trim(),
        type: type || 'physical',
        address: address || null,
        latitude: latitude === '' || latitude === undefined ? null : latitude,
        longitude: longitude === '' || longitude === undefined ? null : longitude,
        maps_url: mapsUrl || null,
        notes: notes || null,
        active: active === undefined ? true : !!active,
      }])
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
    const { id, name, type, address, notes, active } = body;
    let { latitude, longitude } = body;
    const mapsUrl = body.maps_url;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (type !== undefined && !VENUE_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${VENUE_TYPES.join(', ')}` }, { status: 400 });
    }

    if (mapsUrl && (latitude === undefined || latitude === '' || latitude === null) && (longitude === undefined || longitude === '' || longitude === null)) {
      const resolved = await resolveMapsCoordinates(mapsUrl);
      latitude = resolved.latitude;
      longitude = resolved.longitude;
    }

    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (type !== undefined) update.type = type;
    if (address !== undefined) update.address = address || null;
    if (latitude !== undefined) update.latitude = latitude === '' ? null : latitude;
    if (longitude !== undefined) update.longitude = longitude === '' ? null : longitude;
    if (mapsUrl !== undefined) update.maps_url = mapsUrl || null;
    if (notes !== undefined) update.notes = notes || null;
    if (active !== undefined) update.active = !!active;
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { data, error } = await supabaseAdmin.from('venues').update(update).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Blocked by Postgres if any session still references this venue -
// sessions keep venue_id with no cascade, so a used venue can't
// disappear out from under scheduled sessions.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('venues').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
