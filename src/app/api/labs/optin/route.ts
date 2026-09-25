import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyAdminOfRegistration } from '@/lib/registerInterest';
import { cleanText, LAB_GRADES, LAB_ROLES, normaliseSaPhone, upsertLabLead, type LabGrade, type LabRole } from '@/lib/labLeads';
import { labLeadSource } from '@/content/labs';
import { getPublishedLab } from '@/lib/labsRepo';

// Fork Card A ("send me the next lab") and Card B ("join the workshop
// waitlist") on /labs/[slug]. Both are a WhatsApp marketing opt-in, so the
// visitor must tick explicit consent (POPIA) - the wording lives in
// ForkOptIn.tsx and is versioned here.
const CONSENT_WORDING_VERSION = 'lab_optin_v1';

type Intent = 'next_lab' | 'waitlist';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.bot_field) return NextResponse.json({ ok: true }); // honeypot

    const lab = await getPublishedLab(String(body.labSlug || ''));
    if (!lab) return NextResponse.json({ error: 'Unknown lab.' }, { status: 400 });

    const phone = normaliseSaPhone(body.phone);
    if (!phone) return NextResponse.json({ error: 'Please enter a valid WhatsApp number.' }, { status: 400 });

    const role = body.role as LabRole;
    if (!LAB_ROLES.includes(role)) return NextResponse.json({ error: 'Please choose parent or student.' }, { status: 400 });

    const grade = role === 'student' ? (body.grade as LabGrade) : null;
    if (role === 'student' && !LAB_GRADES.includes(grade as LabGrade)) {
      return NextResponse.json({ error: 'Please choose your grade.' }, { status: 400 });
    }

    if (body.consent !== true) return NextResponse.json({ error: 'Please tick the consent box to continue.' }, { status: 400 });

    const name = cleanText(body.name, 80);
    if (name.length < 2) return NextResponse.json({ error: 'Please tell us your name.' }, { status: 400 });

    const intent: Intent = body.intent === 'waitlist' ? 'waitlist' : 'next_lab';

    const supabase = supabaseAdmin();
    const { leadId, isNew } = await upsertLabLead(supabase, {
      phone,
      name,
      role,
      grade,
      source: labLeadSource(lab.slug, 'optin'),
      tags: [intent === 'waitlist' ? 'lab_waitlist' : 'lab_optin', `lab:${lab.slug}`],
      marketingConsent: { wordingVersion: CONSENT_WORDING_VERSION, consentSource: `lab_optin:${lab.slug}` },
    });

    const intentLabel = intent === 'waitlist' ? 'joined the workshop waitlist' : 'asked for the next lab';
    await supabase.from('lead_activities').insert([{
      lead_id: leadId,
      channel: 'website',
      direction: 'inbound',
      outcome: intent === 'waitlist' ? 'lab_waitlist' : 'lab_optin',
      note: `Lab ${lab.slug}: ${role}${grade ? ` (grade ${grade})` : ''} ${intentLabel}.`,
      created_by: 'lab_page',
    }]);

    await notifyAdminOfRegistration(
      supabase,
      leadId,
      `${isNew ? '🆕 New' : '🔁 Returning'} lead from Lab ${lab.slug} — ${intentLabel}.\n` +
      `${name} · ${role}${grade ? ` · grade ${grade}` : ''}\nContact: +${phone}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[labs/optin]', error);
    return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
  }
}
