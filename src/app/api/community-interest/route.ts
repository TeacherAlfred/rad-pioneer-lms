import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { normalizePhone, notifyAdminOfRegistration } from '@/lib/registerInterest';
import { getCommunity } from '@/lib/communities';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Backs the public /[community] pages (communities.ts). Same phone-first
// lead/registration shape as /api/term-program/register, trimmed to the
// page's four fields: name, WhatsApp number, child's age or grade, consent.
// Differences that matter: offers are validated against the community's own
// program list (not show_on_term_page), every row is tagged with the
// community's source, a voucher code off the page URL lands in
// leads.voucher_code. No template goes to the parent - the page instead
// hands them a prefilled wa.me message to the RAD business number, so the
// parent's own message opens the 24-hour reply window. A parent who isn't
// sure which workshop fits sends not_sure instead of picking - no
// registration rows, and the lead is flagged needs_human so it tops the
// admin call queue for a personal recommendation.

// Leads created by Meta's webhook are stored as 27XXXXXXXXX, and Meta only
// delivers to that international form - a parent typing "082 123 4567"
// would otherwise never match the lead the bot creates when they message us.
function toSaInternational(digits: string): string {
  if (digits.length === 10 && digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

// Voucher codes are short uppercase tokens (MOON, 75HARD, PLK-CATS) - anything
// else off the URL is dropped rather than stored.
function cleanVoucher(v: unknown): string | null {
  const code = String(v || '').trim().toUpperCase();
  return /^[A-Z0-9-]{2,20}$/.test(code) ? code : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      community: slug, parent_name, phone, child_age, program_ids, not_sure, consent, voucher_code,
      bot_field, // honeypot - real visitors never fill this
    } = body;

    if (bot_field) return NextResponse.json({ ok: true });

    const community = getCommunity(String(slug || ''));
    if (!community) {
      return NextResponse.json({ error: 'Unknown page.' }, { status: 404 });
    }

    const normPhone = toSaInternational(normalizePhone(phone));
    if (normPhone.length < 10) {
      return NextResponse.json({ error: 'A valid WhatsApp number is required.' }, { status: 400 });
    }
    const trimmedName = String(parent_name || '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    const childAge = String(child_age || '').trim().slice(0, 80);
    if (!childAge) {
      return NextResponse.json({ error: "Please enter your child's age or grade." }, { status: 400 });
    }
    if (consent !== true) {
      return NextResponse.json({ error: 'Consent is required to submit this form.' }, { status: 400 });
    }

    const notSure = not_sure === true;
    const ids: string[] = notSure ? [] : Array.from(new Set((Array.isArray(program_ids) ? program_ids : []).map(String)));
    if (!notSure && ids.length === 0) {
      return NextResponse.json({ error: 'Pick a workshop, or tell us you are not sure.' }, { status: 400 });
    }
    if (ids.some(id => !community.programIds.includes(id))) {
      return NextResponse.json({ error: 'That workshop is not offered on this page.' }, { status: 400 });
    }

    const { data: programs, error: programsErr } = ids.length
      ? await supabaseAdmin
          .from('featured_programs')
          .select('id, title, location, series, draft, live_from, live_until')
          .in('id', ids)
      : { data: [], error: null };
    if (programsErr) throw programsErr;

    const now = Date.now();
    for (const id of ids) {
      const program = (programs || []).find(p => p.id === id);
      if (!program) {
        return NextResponse.json({ error: 'One of the selected workshops could not be found.' }, { status: 404 });
      }
      if (program.draft || now < new Date(program.live_from).getTime() || now > new Date(program.live_until).getTime()) {
        return NextResponse.json({ error: `"${program.title}" is no longer taking registrations.` }, { status: 410 });
      }
    }
    // Keep the community's own display order, not the query's.
    const chosen = community.programIds
      .filter(id => ids.includes(id))
      .map(id => (programs || []).find(p => p.id === id)!);

    const nowIso = new Date().toISOString();
    const voucher = cleanVoucher(voucher_code);

    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, voucher_code')
      .eq('phone', normPhone)
      .maybeSingle();

    let lead: { id: string };

    if (existingLead) {
      lead = existingLead;
      // First-touch attribution, same rule as the webhook's voucher match:
      // never overwrite an existing source or voucher_code.
      await supabaseAdmin.from('leads').update({
        name: trimmedName,
        preferred_channel: 'whatsapp',
        marketing_consent_at: nowIso,
        ...(notSure ? { needs_human: true } : {}),
        ...(voucher && !existingLead.voucher_code ? { voucher_code: voucher } : {}),
      }).eq('id', existingLead.id);
    } else {
      const { data: newLead, error: insertErr } = await supabaseAdmin
        .from('leads')
        .insert([{
          phone: normPhone,
          name: trimmedName,
          status: 'new_lead',
          lifecycle_stage: 'new',
          source: community.source,
          voucher_code: voucher,
          preferred_channel: 'whatsapp',
          number_of_children: 1,
          marketing_consent_at: nowIso,
          needs_human: notSure,
        }])
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      lead = newLead;
      await recordStageChange(supabaseAdmin, lead.id, { toStage: 'new' });
    }

    if (chosen.length) await supabaseAdmin.from('event_registrations').insert(
      chosen.map(program => ({
        lead_id: lead.id,
        program_id: program.id,
        program_title: program.title,
        series: program.series,
        location: program.location,
        date_option_id: null,
        date_label: 'Day to be confirmed',
        number_of_children: 1,
        preferred_channel: 'whatsapp',
        source: community.source,
      }))
    );

    const pickedText = notSure ? 'Not sure which workshop fits - wants a recommendation' : chosen.map(p => p.title).join(' & ');
    await supabaseAdmin.from('lead_activities').insert([{
      lead_id: lead.id,
      channel: 'website',
      direction: 'inbound',
      outcome: 'register_interest',
      note: `/${community.slug} registration: ${pickedText} — child: ${childAge}${voucher ? ` — code ${voucher}` : ''}`,
      created_by: 'community_page_form',
    }]);

    await notifyAdminOfRegistration(
      supabaseAdmin,
      lead.id,
      `${existingLead ? '🔁 Returning' : '🆕 New'} lead from /${community.slug}.\n${notSure ? '❓ Not sure which workshop fits - please call to recommend one' : chosen.map(p => `- ${p.title}`).join('\n')}\nChild: ${childAge}${voucher ? `\nCode: ${voucher}` : ''}\nContact: +${normPhone}`
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('community-interest error', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
