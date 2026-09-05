import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordStageChange } from '@/lib/leadStageHistory';
import { notifyAdminOfRegistration } from '@/lib/registerInterest';

// "Not a chatbot - drop it in, we respond within 24hrs." Writes into the same
// leads/lead_activities/alert-queue pipeline every other lead-intake form on
// the site uses (register-interest, irene-fitness submit's marketing opt-in)
// rather than a separate inbox nobody's watching in the weekly review.
// irene_ prefix on the source tag matters: leadSourceLane.ts buckets by
// prefix, and an un-prefixed tag would silently land in "Unknown" instead of
// the "Irene" lane on the Lead Journey board.
const SOURCE = 'irene_fitfam_contact_form';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name, channel, contact, message } = body as {
    name?: string;
    channel?: 'whatsapp' | 'email';
    contact?: string;
    message?: string;
  };

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const trimmedContact = typeof contact === 'string' ? contact.trim() : '';
  if (!trimmedName || trimmedName.length > 80) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!trimmedMessage || trimmedMessage.length > 1000) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (!trimmedContact) {
    return NextResponse.json({ error: 'A WhatsApp number or email is required' }, { status: 400 });
  }

  const resolvedChannel: 'whatsapp' | 'email' = channel === 'email' ? 'email' : 'whatsapp';
  const waDigits = resolvedChannel === 'whatsapp' ? trimmedContact.replace(/\D/g, '') : '';
  const email = resolvedChannel === 'email' ? trimmedContact : null;
  // leads.phone is NOT NULL - an email-channel submission still needs a
  // placeholder here, same guard register-interest/submit uses. Left as ''
  // exactly as before (not touched by this change) - leads.phone is a
  // shared column read/displayed across the wider CRM (finance, lead
  // journey, WhatsApp-reply buttons elsewhere), so it's not safe to start
  // putting non-phone values in it from this one route.
  const phone = waDigits || '';

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  // Race-safe insert-or-reuse, same idiom as submit/route.ts's marketing
  // opt-in and register-interest/submit.ts: insert first and rely on
  // leads.phone's UNIQUE constraint to reject a duplicate, then fall back to
  // reusing the existing lead. Someone who already has a lead record (e.g.
  // from an earlier webinar registration, or the original Irene Fitness
  // sign-up) must still be able to raise their hand again here - failing on
  // the unique constraint used to surface a raw 500 to them instead of
  // actually capturing the renewed interest.
  //
  // Only attempted when a real WhatsApp number was actually submitted:
  // every email-channel submission shares the same '' placeholder above, so
  // a conflict there doesn't mean "this is the same person" - it'd just be
  // whichever unrelated email-only lead happened to exist first. Silently
  // attributing this message to a random stranger's lead would be worse
  // than the original error, so that rare pre-existing edge case still
  // falls through to a real error below rather than being guessed at.
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert([{
      phone,
      email,
      name: trimmedName,
      status: 'new_lead',
      lifecycle_stage: 'new',
      source: SOURCE,
      school: 'Irene Primary',
      preferred_channel: resolvedChannel,
    }])
    .select('id')
    .single();

  let lead = newLead;
  let isExistingLead = false;

  if (!newLead && waDigits) {
    const { data: existing, error: findError } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', waDigits)
      .maybeSingle();
    if (!findError && existing) {
      lead = existing;
      isExistingLead = true;
    }
  }
  if (!lead) return NextResponse.json({ error: insertError?.message || 'Something went wrong' }, { status: 500 });

  if (!isExistingLead) {
    await recordStageChange(supabase, lead.id, { toStage: 'new' });
  }
  // Deliberately doesn't touch status/lifecycle_stage on an existing lead -
  // same reasoning as submit/route.ts's marketing opt-in: don't regress a
  // lead that's already progressed through the funnel. The activity log
  // entry below is what actually records this renewed interest.

  await supabase.from('lead_activities').insert([{
    lead_id: lead.id,
    channel: 'website',
    direction: 'inbound',
    outcome: 'contact_form',
    note: trimmedMessage,
    created_by: 'fitfam_contact_form',
  }]);

  await notifyAdminOfRegistration(
    supabase,
    lead.id,
    `💬 Fit Fam Contact Form — *${trimmedName}*\n\n${trimmedMessage}\n\nReply via: ${trimmedContact} (${resolvedChannel})`
  );

  return NextResponse.json({ ok: true, submitted_at: now });
}
