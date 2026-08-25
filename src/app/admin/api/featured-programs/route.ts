import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACCENTS = ['bg-rad-teal', 'bg-rad-blue', 'bg-rad-purple'];

// Landing page carousel cards (src/app/page.tsx "Featured Events").
// Reads here use the service role so the admin list always shows every
// row regardless of its live window - the public/anon read on the
// landing page is the one scoped to live_from/live_until (see migration
// 20260821090000_featured_programs.sql).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('featured_programs')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

function validatePayload(body: any, { partial }: { partial: boolean }) {
  const { title, image_url, accent, live_from, live_until } = body;
  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) return 'Title is required';
  }
  if (!partial || image_url !== undefined) {
    if (!image_url || !String(image_url).trim()) return 'Image URL is required';
  }
  if (accent !== undefined && accent !== null && !ACCENTS.includes(accent)) {
    return `accent must be one of: ${ACCENTS.join(', ')}`;
  }
  if (!partial || live_until !== undefined) {
    if (!live_until) return 'Live until date is required';
  }
  if (live_from && live_until && new Date(live_from) > new Date(live_until)) {
    return 'Live until must be on or after live from';
  }
  return null;
}

// Publish gate (Quote & Pricing Engine spec §3): a program can't go live
// (draft -> false) without at least one published, priced package attached
// and a quote email template chosen - both compulsory per the founder's
// explicit requirement, not just encouraged. Only checked when draft is
// actually being turned off; editing a program that's already live, or
// staying in draft, is unaffected.
async function checkPublishGate(supabase: any, featuredProgramId: string) {
  const [{ data: publishedPackages }, { data: program }] = await Promise.all([
    supabase.from('event_packages').select('id').eq('featured_program_id', featuredProgramId).eq('published', true).limit(1),
    supabase.from('featured_programs').select('quote_email_template_id').eq('id', featuredProgramId).single(),
  ]);
  if (!publishedPackages || publishedPackages.length === 0) {
    return 'This program needs at least one published, priced package attached (Packages & Quote Email section) before it can go live.';
  }
  if (!program?.quote_email_template_id) {
    return 'This program needs a quote email template selected (Packages & Quote Email section) before it can go live.';
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err = validatePayload(body, { partial: false });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      title, label, location, details, duration, form_label, series,
      image_url, is_video, accent, sort_order, live_from, live_until, date_options, draft, allow_multi_date,
      show_on_events_page, show_on_homepage, counts_general_attendees,
      programs_id, default_session_id, expected_attendee_count, quote_email_template_id,
    } = body;

    // A brand-new program can never satisfy the publish gate yet (packages
    // can only be attached once the row - and its id - exists), so it's
    // always created as draft regardless of what's sent; going live happens
    // via a later PATCH once the compulsory step is done.
    const { data, error } = await supabaseAdmin
      .from('featured_programs')
      .insert([{
        title: String(title).trim(),
        label: label ? String(label).trim() : 'Program',
        location: location || null,
        details: details || null,
        duration: duration || null,
        form_label: form_label || null,
        series: series ? String(series).trim() : null,
        image_url: String(image_url).trim(),
        is_video: !!is_video,
        accent: accent || 'bg-rad-blue',
        sort_order: sort_order === '' || sort_order === undefined ? 0 : Number(sort_order),
        live_from: live_from || new Date().toISOString(),
        live_until,
        date_options: Array.isArray(date_options) ? date_options : [],
        draft: true,
        allow_multi_date: !!allow_multi_date,
        show_on_events_page: show_on_events_page === undefined ? true : !!show_on_events_page,
        show_on_homepage: show_on_homepage === undefined ? true : !!show_on_homepage,
        counts_general_attendees: !!counts_general_attendees,
        programs_id: programs_id || null,
        default_session_id: default_session_id || null,
        expected_attendee_count: expected_attendee_count === '' || expected_attendee_count === undefined ? null : Number(expected_attendee_count),
        quote_email_template_id: quote_email_template_id || null,
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
    const err = validatePayload(body, { partial: true });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      title, label, location, details, duration, form_label, series,
      image_url, is_video, accent, sort_order, live_from, live_until, date_options, draft, allow_multi_date,
      show_on_events_page, show_on_homepage, counts_general_attendees,
      programs_id, default_session_id, expected_attendee_count, quote_email_template_id, quote_email_template_needs_review,
    } = body;

    // Publish gate: only checked when this PATCH is actually the moment
    // draft flips to false - editing an already-live program, or staying in
    // draft, never hits it.
    if (draft === false) {
      const gateErr = await checkPublishGate(supabaseAdmin, id);
      if (gateErr) return NextResponse.json({ error: gateErr }, { status: 400 });
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (date_options !== undefined) update.date_options = Array.isArray(date_options) ? date_options : [];
    if (draft !== undefined) update.draft = !!draft;
    if (allow_multi_date !== undefined) update.allow_multi_date = !!allow_multi_date;
    if (show_on_events_page !== undefined) update.show_on_events_page = !!show_on_events_page;
    if (show_on_homepage !== undefined) update.show_on_homepage = !!show_on_homepage;
    if (counts_general_attendees !== undefined) update.counts_general_attendees = !!counts_general_attendees;
    if (title !== undefined) update.title = String(title).trim();
    if (label !== undefined) update.label = label ? String(label).trim() : 'Program';
    if (location !== undefined) update.location = location || null;
    if (details !== undefined) update.details = details || null;
    if (duration !== undefined) update.duration = duration || null;
    if (form_label !== undefined) update.form_label = form_label || null;
    if (series !== undefined) update.series = series ? String(series).trim() : null;
    if (image_url !== undefined) update.image_url = String(image_url).trim();
    if (is_video !== undefined) update.is_video = !!is_video;
    if (accent !== undefined) update.accent = accent || 'bg-rad-blue';
    if (sort_order !== undefined) update.sort_order = sort_order === '' ? 0 : Number(sort_order);
    if (live_from !== undefined) update.live_from = live_from;
    if (live_until !== undefined) update.live_until = live_until;
    if (programs_id !== undefined) update.programs_id = programs_id || null;
    if (default_session_id !== undefined) update.default_session_id = default_session_id || null;
    if (expected_attendee_count !== undefined) update.expected_attendee_count = expected_attendee_count === '' ? null : Number(expected_attendee_count);
    if (quote_email_template_id !== undefined) {
      update.quote_email_template_id = quote_email_template_id || null;
      // Picking a template explicitly clears the "needs review" backfill
      // flag - this IS the founder reviewing it, unless they're clearing the
      // template entirely (needs_review stays true in that edge case, since
      // an empty selection needs re-review just as much as the placeholder did).
      if (quote_email_template_id) update.quote_email_template_needs_review = false;
    }
    if (quote_email_template_needs_review !== undefined) update.quote_email_template_needs_review = !!quote_email_template_needs_review;

    const { data, error } = await supabaseAdmin
      .from('featured_programs')
      .update(update)
      .eq('id', id)
      .select()
      .single();
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
    const { error } = await supabaseAdmin.from('featured_programs').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
