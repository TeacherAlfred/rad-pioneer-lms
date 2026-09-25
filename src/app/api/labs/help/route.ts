import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdminOfRegistration } from '@/lib/registerInterest';
import { cleanText, LAB_ROLES, normaliseSaPhone, upsertLabLead, type LabRole } from '@/lib/labLeads';
import { labLeadSource } from '@/content/labs';
import { getPublishedLab } from '@/lib/labsRepo';

// Floating "I need help" sheet on /labs/[slug]. leads has no message /
// urgency columns, so the request is stored the way the webhook and the
// finance-v2 request-change route already hand off to a person: the lead
// row gets needs_human = true (surfaces it in the admin queue), the message
// goes into lead_notes, and a lead_activities row records the contact.
// No marketing consent is implied - a help request is not an opt-in.
const URGENCY = { medium: 'Soon as possible', high: 'Blocking me right now' } as const;
type Urgency = keyof typeof URGENCY;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.bot_field) return NextResponse.json({ ok: true }); // honeypot

    const lab = await getPublishedLab(String(body.labSlug || ''));
    if (!lab) return NextResponse.json({ error: 'Unknown lab.' }, { status: 400 });

    const phone = normaliseSaPhone(body.phone);
    if (!phone) return NextResponse.json({ error: 'Please enter a valid number so we can get back to you.' }, { status: 400 });

    const name = cleanText(body.name, 80);
    if (name.length < 2) return NextResponse.json({ error: 'Please tell us your name.' }, { status: 400 });

    const role = body.role as LabRole;
    if (!LAB_ROLES.includes(role)) return NextResponse.json({ error: 'Please choose parent or student.' }, { status: 400 });

    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    if (message.length < 3) return NextResponse.json({ error: 'Tell us a little about what you need help with.' }, { status: 400 });

    const urgency: Urgency = (body.urgency in URGENCY ? body.urgency : 'medium') as Urgency;
    const stepTitle = cleanText(body.step, 80);

    const supabase = supabaseAdmin();
    const { leadId, isNew } = await upsertLabLead(supabase, {
      phone,
      name,
      role,
      source: labLeadSource(lab.slug, 'help'),
      tags: ['lab_help', `lab:${lab.slug}`],
    });

    const context = `${name} · Lab ${lab.slug}${stepTitle ? `, step "${stepTitle}"` : ''} · ${role} · ${URGENCY[urgency]}`;

    await Promise.all([
      supabase.from('lead_notes').insert([{ lead_id: leadId, note: `Help request (${context}):\n${message}`, created_by: 'lab_page' }]),
      supabase.from('lead_activities').insert([{
        lead_id: leadId,
        channel: 'website',
        direction: 'inbound',
        outcome: 'help_request',
        note: `${context}: ${message.slice(0, 200)}`,
        created_by: 'lab_page',
      }]),
      supabase.from('leads').update({ needs_human: true }).eq('id', leadId),
    ]);

    await notifyAdminOfRegistration(
      supabase,
      leadId,
      `🆘 ${urgency === 'high' ? '*URGENT* ' : ''}Help request from Lab ${lab.slug}${isNew ? ' (new lead)' : ''}\n` +
      `${context}\n\n"${message.slice(0, 500)}"\n\nCall back: +${phone}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[labs/help]', error);
    return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
  }
}
