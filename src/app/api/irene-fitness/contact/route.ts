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
  // placeholder here, same guard register-interest/submit uses.
  const phone = waDigits || '';

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: lead, error: leadError } = await supabase
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
    .select()
    .single();
  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });

  await recordStageChange(supabase, lead.id, { toStage: 'new' });

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
