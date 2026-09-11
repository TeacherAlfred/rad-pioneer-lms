import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone, generateLinkCode, linkCodeExpiresAt, buildLinkPhoneWaLink } from '@/lib/tutorialProgress';

// Service role: tutorial_visitors carries a phone number and has zero anon
// RLS policies, same posture as guardian_consent_tokens.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Issues (or re-issues) a short WhatsApp click-to-chat code for a phone
// number, so a Tutorial Hub visitor can prove they hold it without an SMS/
// OTP vendor (see src/lib/tutorialProgress.ts). A fresh code is generated
// on every call rather than reusing an unexpired one - this endpoint has
// no auth of its own, so treating "already has a pending code" as reason
// to skip re-issuing would let a repeat request outlive the intended
// 15-minute window.
export async function POST(req: Request) {
  try {
    const { phone, utm_source, utm_medium, utm_campaign, referrer } = await req.json();
    const normalized = normalizePhone(phone);
    if (normalized.length < 9) {
      return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    const code = generateLinkCode();
    const expiresAt = linkCodeExpiresAt();

    const { data: existing } = await supabaseAdmin
      .from('tutorial_visitors')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('tutorial_visitors')
        .update({ pending_link_code: code, pending_link_code_expires_at: expiresAt })
        .eq('id', existing.id);
    } else {
      const { error: insertError } = await supabaseAdmin.from('tutorial_visitors').insert([{
        phone: normalized,
        pending_link_code: code,
        pending_link_code_expires_at: expiresAt,
        attribution_utm_source: utm_source || null,
        attribution_utm_medium: utm_medium || null,
        attribution_utm_campaign: utm_campaign || null,
        attribution_referrer: referrer || null,
      }]);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ code, waLink: buildLinkPhoneWaLink(code) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
