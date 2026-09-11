import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACCENTS = ['bg-rad-teal', 'bg-rad-blue', 'bg-rad-purple', 'bg-rad-green', 'bg-rad-yellow'];

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tutorial_offer_config')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

function validate(body: any) {
  if (!body.headline || !String(body.headline).trim()) return 'Headline is required';
  if (!body.destination_url || !String(body.destination_url).trim()) return 'Destination URL is required';
  if (body.accent && !ACCENTS.includes(body.accent)) return `accent must be one of: ${ACCENTS.join(', ')}`;
  return null;
}

// tutorial_offer_config_single_active_idx (a unique index on is_active
// where is_active) enforces only one live offer at a time - deactivating
// every other row first, rather than relying on the DB to reject a
// conflict, keeps "activate this one" a single clean action from the
// admin's point of view instead of an error to work around.
async function deactivateOthers(exceptId?: string) {
  let query = supabaseAdmin.from('tutorial_offer_config').update({ is_active: false }).eq('is_active', true);
  if (exceptId) query = query.neq('id', exceptId);
  await query;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    if (body.is_active) await deactivateOthers();

    const { data, error } = await supabaseAdmin
      .from('tutorial_offer_config')
      .insert([{
        headline: String(body.headline).trim(),
        body: body.body || null,
        cta_label: body.cta_label ? String(body.cta_label).trim() : 'Learn more',
        destination_url: String(body.destination_url).trim(),
        accent: body.accent || 'bg-rad-blue',
        is_active: !!body.is_active,
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
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { headline, body: offerBody, cta_label, destination_url, accent, is_active } = body;
    if (accent !== undefined && accent !== null && !ACCENTS.includes(accent)) {
      return NextResponse.json({ error: `accent must be one of: ${ACCENTS.join(', ')}` }, { status: 400 });
    }

    if (is_active === true) await deactivateOthers(id);

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (headline !== undefined) update.headline = String(headline).trim();
    if (offerBody !== undefined) update.body = offerBody || null;
    if (cta_label !== undefined) update.cta_label = cta_label ? String(cta_label).trim() : 'Learn more';
    if (destination_url !== undefined) update.destination_url = String(destination_url).trim();
    if (accent !== undefined) update.accent = accent || 'bg-rad-blue';
    if (is_active !== undefined) update.is_active = !!is_active;

    const { data, error } = await supabaseAdmin.from('tutorial_offer_config').update(update).eq('id', id).select().single();
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
    const { error } = await supabaseAdmin.from('tutorial_offer_config').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
