import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { normalizePhone, verifyConfirmToken, notifyAdminOfRegistration } from '@/lib/registerInterest';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SOP §1/§3/§4/§7/§9 final submit. Does NOT implement §5 (auto-quote) or
// §6 (quote/accept/pay/invoice) - those are blocked on real prerequisites
// the SOP itself flags in §10 (pricing not yet encoded as queryable data,
// Payfast programmatic-link support unconfirmed), not a scope choice made
// here. This ends with a "we'll follow up" confirmation instead.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      program_id, date_option_id, number_of_children,
      preferred_channel, email, full_name, whatsapp_number,
      consent, confirm_token, utm_source, utm_campaign, referrer,
      bot_field, // honeypot - real visitors never fill this
    } = body;

    if (bot_field) return NextResponse.json({ ok: true }); // silently swallow bots

    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    const nChildren = Number(number_of_children);
    if (!Number.isInteger(nChildren) || nChildren < 1) {
      return NextResponse.json({ error: 'Number of children must be at least 1.' }, { status: 400 });
    }
    if (consent !== true) {
      return NextResponse.json({ error: 'Consent is required to submit this form.' }, { status: 400 });
    }
    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required.' }, { status: 400 });
    }

    const { data: program } = await supabaseAdmin
      .from('featured_programs')
      .select('id, title, location, date_options')
      .eq('id', program_id)
      .maybeSingle();
    if (!program) return NextResponse.json({ error: 'That program could not be found.' }, { status: 404 });

    const dateOption = date_option_id
      ? (program.date_options || []).find((d: any) => d.id === date_option_id)
      : null;

    const normEmail = String(email).trim();
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, source')
      .ilike('email', normEmail)
      .maybeSingle();

    const confirmed = !!existingLead && verifyConfirmToken(confirm_token, normEmail);

    // SOP §3 step 4: on a confirmed match, name/phone are pulled from the
    // record server-side - the client never sends (and this route never
    // trusts) name/phone for a confirmed identity, so nothing the visitor
    // typed can overwrite it.
    const resolvedName = confirmed ? existingLead!.name : (full_name ? String(full_name).trim() : null);
    let resolvedPhone = confirmed ? existingLead!.phone : (whatsapp_number ? String(whatsapp_number).trim() : null);

    if (!confirmed && !resolvedName) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    // SOP §4: silent auto-resolve, never a blocking prompt.
    let resolvedChannel = preferred_channel === 'email' ? 'email' : 'whatsapp';
    if (resolvedChannel === 'whatsapp' && normalizePhone(resolvedPhone).length < 8) {
      resolvedChannel = 'email';
    }

    const dateLabel = dateOption?.label || null;
    const nowIso = new Date().toISOString();
    const activityNote = `Register Interest: ${program.title}${dateLabel ? ` — ${dateLabel}` : ''} — ${nChildren} child${nChildren === 1 ? '' : 'ren'}` +
      (utm_source ? ` (utm_source=${utm_source}${utm_campaign ? `, utm_campaign=${utm_campaign}` : ''})` : '') +
      (referrer ? ` [ref: ${referrer}]` : '');

    let leadId: string;

    if (existingLead) {
      leadId = existingLead.id;
      const update: Record<string, any> = {
        preferred_channel: resolvedChannel,
        number_of_children: nChildren,
        interested_program_id: program.id,
        interested_date_label: dateLabel,
        marketing_consent_at: nowIso,
      };
      if (resolvedName) update.name = resolvedName;
      if (resolvedPhone) update.phone = resolvedPhone;
      await supabaseAdmin.from('leads').update(update).eq('id', leadId);
    } else {
      const { data: newLead, error: insertErr } = await supabaseAdmin
        .from('leads')
        .insert([{
          email: normEmail,
          name: resolvedName,
          phone: resolvedPhone || '', // leads.phone is NOT NULL; WhatsApp number is optional on this form
          status: 'new_lead',
          lifecycle_stage: 'new',
          source: utm_source ? `website_${utm_source}` : 'website_register_interest',
          preferred_channel: resolvedChannel,
          number_of_children: nChildren,
          interested_program_id: program.id,
          interested_date_label: dateLabel,
          marketing_consent_at: nowIso,
        }])
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      leadId = newLead.id;
      await recordStageChange(supabaseAdmin, leadId, { toStage: 'new' });
    }

    await supabaseAdmin.from('lead_activities').insert([{
      lead_id: leadId,
      channel: 'website',
      direction: 'inbound',
      outcome: 'register_interest',
      note: activityNote,
      created_by: 'register_interest_form',
    }]);

    await notifyAdminOfRegistration(
      supabaseAdmin,
      leadId,
      `${existingLead ? '🔁 Returning' : '🆕 New'} lead registered interest.\nProgram: ${program.title}${dateLabel ? ` (${dateLabel})` : ''}\nLocation: ${program.location || 'n/a'}\nChildren: ${nChildren}\nContact: ${resolvedChannel === 'whatsapp' ? `+${normalizePhone(resolvedPhone)}` : normEmail}`
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
