import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { notifyAdminOfRegistration } from '@/lib/registerInterest';
import { isWithinDnd, type DndDay } from '@/lib/dndSchedule';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';

// Bump whenever the consent copy on Step 1 of the Irene Fitness page changes,
// so a stored consent record always reflects exactly what was agreed to.
const CONSENT_WORDING_VERSION = 'v2.0-2026-08';
const FAMILY_COOKIE = 'irene_fitness_family';
const FAMILY_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
const VALID_SOURCES = ['irene_paper_qr', 'irene_web_direct', 'irene_gallery_cta'];

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || req.headers.get('x-real-ip') || null;
}

function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// The durable "my link" token (/projects/irene-fitness/me/{token}) - only
// generated once, on first creation, and never touched again on edit, since
// the whole point is a link that stays valid across every future visit. The
// slug half is cosmetic (readable, easy to say over WhatsApp); the random
// suffix is the actual security boundary.
function generateAccessToken(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'family';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      consent,
      consent_source,
      display_name,
      whatsapp,
      email,
      children,
      consent_updates,
      consent_marketing,
    } = body;

    if (consent !== true) {
      return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
    }
    if (!VALID_SOURCES.includes(consent_source)) {
      return NextResponse.json({ error: 'Invalid consent_source' }, { status: 400 });
    }
    const name = typeof display_name === 'string' ? display_name.trim() : '';
    if (!name || name.length > 40) {
      return NextResponse.json({ error: 'Display name must be 1-40 characters' }, { status: 400 });
    }
    const waDigits = typeof whatsapp === 'string' ? whatsapp.replace(/\D/g, '') : '';
    const emailTrimmed = typeof email === 'string' ? email.trim() : '';
    if (!waDigits && !emailTrimmed) {
      return NextResponse.json({ error: 'A WhatsApp number or email is required' }, { status: 400 });
    }
    const childList = Array.isArray(children) ? children.slice(0, 6) : [];
    for (const child of childList) {
      if (!child?.grade) {
        return NextResponse.json({ error: 'Each child needs a grade' }, { status: 400 });
      }
      if (child.class !== undefined && typeof child.class !== 'string') {
        return NextResponse.json({ error: 'Invalid class' }, { status: 400 });
      }
    }
    if (childList.length === 0) {
      return NextResponse.json({ error: 'Add at least one child' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const now = new Date().toISOString();
    const ipAddress = clientIp(request);

    // Returning visitor: the family_session cookie tells us which family this
    // is even before we look at whatsapp/email, so an update always lands on
    // the right row instead of accidentally creating a duplicate family.
    const cookieHeader = request.headers.get('cookie') || '';
    const existingFamilyId = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${FAMILY_COOKIE}=`))
      ?.split('=')[1];

    // consent_public_display is deliberately NOT in this shared payload - a
    // returning visitor tweaking their story after opting out (via
    // /api/irene-fitness/opt-out) must not get silently flipped back to
    // publicly visible on their next save. Only a brand-new family (never
    // asked before) gets it defaulted to true, via insertPayload below;
    // existing families keep whatever they last chose.
    const familyPayload = {
      whatsapp: waDigits || null,
      email: emailTrimmed || null,
      ip_address: ipAddress,
      consent_wording_version: CONSENT_WORDING_VERSION,
      consent_source,
      consent_updates: consent_updates === true,
      consent_updates_timestamp: consent_updates === true ? now : null,
      consent_marketing: consent_marketing === true,
      consent_marketing_timestamp: consent_marketing === true ? now : null,
    };
    const insertPayload = {
      ...familyPayload,
      consent_public_display: true,
      consent_public_display_timestamp: now,
      access_token: generateAccessToken(name),
    };

    let family: any = null;

    if (existingFamilyId) {
      // maybeSingle, not single: the cookie can outlive its row (deleted or
      // reset server-side) since it's kept for 180 days. That must fall
      // through to lookup-or-create below, not throw "Cannot coerce the
      // result to a single JSON object" at the visitor.
      const { data, error } = await supabase
        .from('irene_fitness_families')
        .update(familyPayload)
        .eq('id', existingFamilyId)
        .select()
        .maybeSingle();
      if (error) throw error;
      family = data;
    }

    if (!family) {
      // Race-safe lookup-or-create: insert first and rely on the whatsapp/
      // email UNIQUE constraints to reject a duplicate, then fall back to a
      // select+update on conflict — same idiom as leads.phone elsewhere.
      const { data: inserted } = await supabase
        .from('irene_fitness_families')
        .insert([insertPayload])
        .select()
        .single();

      if (inserted) {
        family = inserted;
      } else {
        const lookupCol = waDigits ? 'whatsapp' : 'email';
        const lookupVal = waDigits || emailTrimmed;
        const { data: existing, error: findError } = await supabase
          .from('irene_fitness_families')
          .select('*')
          .eq(lookupCol, lookupVal)
          .single();
        if (findError) throw findError;

        const { data: updated, error: updateError } = await supabase
          .from('irene_fitness_families')
          .update(familyPayload)
          .eq('id', existing.id)
          .select()
          .single();
        if (updateError) throw updateError;
        family = updated;
      }
    }

    // Was this response already approved/live before this save? qa_confirmed
    // is about to get reset to false either way (below), which would
    // otherwise make "first-time submission" and "edit of a live response"
    // indistinguishable in the QA queue - checked here, before the upsert
    // wipes the evidence.
    const { data: priorResponse } = await supabase
      .from('irene_fitness_responses')
      .select('qa_confirmed')
      .eq('family_id', family.id)
      .maybeSingle();
    const wasLiveBeforeEdit = !!priorResponse?.qa_confirmed;

    // Upsert the one public response for this family (unique on family_id).
    // qa_confirmed is reset to false on every submit, new or edited - any
    // content change (including a first-time typo fix) needs a fresh admin
    // sign-off before it's shown/voteable publicly again (see api/irene-
    // fitness/feed and api/irene-fitness/vote's qa_confirmed gate).
    // edited_after_approval_at is only set (not cleared) here - omitting it
    // for a non-live edit leaves whatever value it already had untouched,
    // since Supabase's upsert only updates the columns actually passed.
    const { data: response, error: responseError } = await supabase
      .from('irene_fitness_responses')
      .upsert(
        {
          family_id: family.id,
          display_name: name,
          updated_at: now,
          qa_confirmed: false,
          qa_confirmed_at: null,
          ...(wasLiveBeforeEdit ? { edited_after_approval_at: now } : {}),
        },
        { onConflict: 'family_id' }
      )
      .select()
      .single();
    if (responseError) throw responseError;

    // A family editing a response that was already live/approved is worth a
    // heads-up - unlike a first-time submission, this can change content
    // that's already public and been voted on. Plain WhatsApp text, not the
    // lead-funnel's interactive-buttons alert (notifyAdminOfRegistration): a
    // family isn't necessarily a lead, and admin_notification_buffer's
    // lead_id column is NOT NULL, so there's no shared buffer to fall back
    // into during DND - this simply skips sending in quiet hours, relying
    // on the Responses page's "Edited since approval" badge
    // (edited_after_approval_at) as the catch-up path admin will see next
    // time they open it.
    if (wasLiveBeforeEdit && process.env.ADMIN_PHONE_NUMBER) {
      const { data: schedule } = await supabase.from('admin_dnd_schedule').select('*');
      if (!isWithinDnd((schedule as DndDay[]) || [])) {
        await sendWhatsAppMessage(process.env.ADMIN_PHONE_NUMBER, {
          type: 'text',
          text: {
            body: `✏️ Fit Fam Edit — *${name}* just edited a response that was already approved/live. Contact: ${waDigits || emailTrimmed}. Worth a re-check on the Responses page.`,
          },
        });
      }
    }

    // Children are replaced wholesale each submit, not merged — they're never
    // shown publicly and votes attach to the response id, not to a child row.
    await supabase.from('irene_fitness_children').delete().eq('family_id', family.id);
    const { error: childrenError } = await supabase.from('irene_fitness_children').insert(
      childList.map((child: { grade: string; class?: string }) => ({
        family_id: family.id,
        grade: child.grade,
        class: child.class?.trim() || null,
      }))
    );
    if (childrenError) throw childrenError;

    // Marketing opt-in hands off to the existing lead-funnel table using its
    // own race-safe insert pattern (matching on phone) rather than a new one.
    if (consent_marketing === true && waDigits) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert([{
          phone: waDigits,
          status: 'new_lead',
          lifecycle_stage: 'new',
          source: 'irene_fitness',
          school: 'Irene Primary',
          name,
          consent_marketing: true,
          consent_timestamp: now,
          consent_wording_version: CONSENT_WORDING_VERSION,
          consent_source,
        }])
        .select()
        .single();

      let lead = newLead;
      if (newLead) {
        await recordStageChange(supabase, newLead.id, { toStage: 'new' });
      } else {
        // Phone already has a lead (e.g. from a different channel entirely) -
        // don't touch its funnel status/history, but the guide still needs
        // to go out, so fall through to the notify below on the existing row.
        const { data: existingLead } = await supabase.from('leads').select('id').eq('phone', waDigits).single();
        lead = existingLead;
      }

      if (lead) {
        // So the RAD Academy coding/robotics guide actually gets sent instead
        // of the lead sitting unnoticed - same alert path (DND-aware, buffers
        // if quiet hours) as every other lead-intake form. Fires whether this
        // is a brand-new lead or one that already existed from elsewhere.
        await notifyAdminOfRegistration(
          supabase,
          lead.id,
          `🏃 Irene Fitness Challenge — *${name}* opted in for the RAD Academy coding & robotics guide. WhatsApp: ${waDigits}`
        );
      }
    }

    const res = NextResponse.json({ ok: true, response_id: response.id, display_name: response.display_name });
    res.cookies.set(FAMILY_COOKIE, family.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: FAMILY_COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (error: any) {
    console.error('Irene fitness submit route error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
