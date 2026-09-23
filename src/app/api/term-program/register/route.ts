import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { normalizePhone, notifyAdminOfRegistration } from '@/lib/registerInterest';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Phone-first counterpart to /api/register-interest/submit, for the
// evergreen /term-program page (a self-contained "one stop shop" of a
// term's sessions, multi-select rather than one-program-at-a-time). Keyed
// on phone rather than email since this page's audience is WhatsApp-first
// - matches leads.phone's NOT NULL/unique constraint and the WhatsApp
// bot's own lead-creation convention, so a parent who registers here and
// later messages the bot resolves to the same lead. Deliberately skips the
// Quote & Pricing Engine and confirm-token machinery in submit/route.ts -
// term-program cards never carry pricing packages.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      parent_name, phone, email, children_info, number_of_children, note,
      selections, consent,
      bot_field, // honeypot - real visitors never fill this
    } = body;

    if (bot_field) return NextResponse.json({ ok: true }); // silently swallow bots

    const normPhone = normalizePhone(phone);
    if (normPhone.length < 8) {
      return NextResponse.json({ error: 'A valid WhatsApp number is required.' }, { status: 400 });
    }
    if (!parent_name || !String(parent_name).trim()) {
      return NextResponse.json({ error: "Parent's name is required." }, { status: 400 });
    }
    if (!Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json({ error: 'Select at least one session.' }, { status: 400 });
    }
    const nChildren = Number(number_of_children);
    if (!Number.isInteger(nChildren) || nChildren < 1) {
      return NextResponse.json({ error: 'Number of children must be at least 1.' }, { status: 400 });
    }
    if (consent !== true) {
      return NextResponse.json({ error: 'Consent is required to submit this form.' }, { status: 400 });
    }

    const programIds = Array.from(new Set(selections.map((s: any) => s.program_id).filter(Boolean)));
    if (programIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one session.' }, { status: 400 });
    }

    const { data: programs, error: programsErr } = await supabaseAdmin
      .from('featured_programs')
      .select('id, title, location, series, date_options, draft, live_from, live_until, show_on_term_page')
      .in('id', programIds);
    if (programsErr) throw programsErr;

    const programById = new Map((programs || []).map((p: any) => [p.id, p]));
    const now = Date.now();
    // Re-validate every selection server-side - the client's list can go
    // stale (a card taken down, put back in draft, or its window expired)
    // between page load and submit. Reject the whole request rather than
    // silently dropping a selection, so the parent isn't surprised later
    // by a registration missing something they picked.
    for (const id of programIds) {
      const program = programById.get(id);
      if (!program) {
        return NextResponse.json({ error: 'One of the selected sessions could not be found.' }, { status: 404 });
      }
      if (!program.show_on_term_page || program.draft || now < new Date(program.live_from).getTime() || now > new Date(program.live_until).getTime()) {
        return NextResponse.json({ error: `"${program.title}" is no longer accepting registrations.` }, { status: 410 });
      }
    }

    const resolvedSelections = selections.map((s: any) => {
      const program: any = programById.get(s.program_id);
      const dateOptions = program.date_options || [];
      const match = dateOptions.find((d: any) => d.id === s.date_option_id);
      return {
        program,
        date_option_id: s.date_option_id || null,
        date_label: match ? match.label : null,
      };
    });

    const nowIso = new Date().toISOString();
    const trimmedName = String(parent_name).trim();
    const trimmedEmail = email ? String(email).trim() : null;

    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('phone', normPhone)
      .maybeSingle();

    let leadId: string;
    let registrationSource: string | null = 'website_term_program';

    if (existingLead) {
      leadId = existingLead.id;
      await supabaseAdmin.from('leads').update({
        name: trimmedName,
        email: trimmedEmail || undefined,
        preferred_channel: 'whatsapp',
        number_of_children: nChildren,
        marketing_consent_at: nowIso,
      }).eq('id', leadId);
    } else {
      const { data: newLead, error: insertErr } = await supabaseAdmin
        .from('leads')
        .insert([{
          phone: normPhone,
          name: trimmedName,
          email: trimmedEmail,
          status: 'new_lead',
          lifecycle_stage: 'new',
          source: registrationSource,
          preferred_channel: 'whatsapp',
          number_of_children: nChildren,
          marketing_consent_at: nowIso,
        }])
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      leadId = newLead.id;
      await recordStageChange(supabaseAdmin, leadId, { toStage: 'new' });
    }

    await supabaseAdmin.from('event_registrations').insert(
      resolvedSelections.map(({ program, date_option_id, date_label }) => ({
        lead_id: leadId,
        program_id: program.id,
        program_title: program.title,
        series: program.series,
        location: program.location,
        date_option_id,
        date_label,
        number_of_children: nChildren,
        preferred_channel: 'whatsapp',
        source: registrationSource,
      }))
    );

    const sessionLines = resolvedSelections
      .map(({ program, date_label }) => `${program.title}${date_label ? ` (${date_label})` : ''}`)
      .join('; ');
    const activityNote = `Term Program registration: ${sessionLines} — ${nChildren} child${nChildren === 1 ? '' : 'ren'}` +
      (children_info ? ` [${String(children_info).trim()}]` : '') +
      (note ? ` — note: ${String(note).trim()}` : '');

    await supabaseAdmin.from('lead_activities').insert([{
      lead_id: leadId,
      channel: 'website',
      direction: 'inbound',
      outcome: 'register_interest',
      note: activityNote,
      created_by: 'term_program_form',
    }]);

    await notifyAdminOfRegistration(
      supabaseAdmin,
      leadId,
      `${existingLead ? '🔁 Returning' : '🆕 New'} lead registered for Term Program.\n${resolvedSelections.map(({ program, date_label }) => `- ${program.title}${date_label ? ` (${date_label})` : ''}`).join('\n')}\nChildren: ${nChildren}${children_info ? ` (${String(children_info).trim()})` : ''}\nContact: +${normPhone}`
    );

    return NextResponse.json({ ok: true, leadId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
