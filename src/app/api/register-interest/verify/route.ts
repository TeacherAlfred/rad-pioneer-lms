import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { last4, signConfirmToken } from '@/lib/registerInterest';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;

function hashCode(code: string, leadId: string) {
  // leadId salts the hash so two leads never collide on the same 6-digit
  // code even if generated in the same millisecond.
  return createHash('sha256').update(`${code}:${leadId}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
}

// SOP §3 steps 2-3: primary last-4-digits path and the "send me a code
// instead" fallback share one attempt counter (leads.confirm_fail_count) -
// both are the same "returning-lead confirmation" gate, not two separate
// security domains, and the SOP itself frames this whole step as "not a
// payment-grade auth step". 3 fails (in either method, in a rolling 15min
// window) exhausts it and the client falls through to the fresh-entry
// form, exactly as the SOP's build note specifies.
export async function POST(req: Request) {
  try {
    const { email, method, value } = await req.json();
    if (!email || !method || !value) {
      return NextResponse.json({ error: 'email, method, and value are required' }, { status: 400 });
    }
    if (method !== 'last4' && method !== 'code' && method !== 'email') {
      return NextResponse.json({ error: 'method must be "last4", "code", or "email"' }, { status: 400 });
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, phone, confirm_fail_count, confirm_fail_reset_at, otp_code_hash, otp_expires_at')
      .ilike('email', String(email).trim())
      .maybeSingle();

    if (!lead) {
      // No record - the client should already have skipped confirmation
      // via /lookup, but fail safe rather than 500.
      return NextResponse.json({ ok: false, exhausted: true });
    }

    // The no-phone-on-file path (nothing to check last-4 digits against,
    // and no unsolicited OTP email either - see verify's sibling routes):
    // retyping the same email they already gave isn't a secret guess to
    // rate-limit, it's just a confirmation gesture, so this skips the
    // shared attempt counter entirely.
    if (method === 'email') {
      const success = String(value).trim().toLowerCase() === String(email).trim().toLowerCase();
      return success
        ? NextResponse.json({ ok: true, token: signConfirmToken(email) })
        : NextResponse.json({ ok: false });
    }

    const now = Date.now();
    const resetAt = lead.confirm_fail_reset_at ? new Date(lead.confirm_fail_reset_at).getTime() : 0;
    let failCount = resetAt > now ? lead.confirm_fail_count : 0;

    if (failCount >= MAX_ATTEMPTS) {
      return NextResponse.json({ ok: false, exhausted: true });
    }

    let success = false;
    if (method === 'last4') {
      success = last4(lead.phone) !== '' && last4(lead.phone) === String(value).trim();
    } else {
      const expired = !lead.otp_expires_at || new Date(lead.otp_expires_at).getTime() < now;
      success = !expired && !!lead.otp_code_hash && lead.otp_code_hash === hashCode(String(value).trim(), lead.id);
    }

    if (success) {
      await supabaseAdmin.from('leads').update({
        confirm_fail_count: 0,
        confirm_fail_reset_at: null,
        otp_code_hash: null,
        otp_expires_at: null,
      }).eq('id', lead.id);
      return NextResponse.json({ ok: true, token: signConfirmToken(email) });
    }

    const nextCount = failCount + 1;
    await supabaseAdmin.from('leads').update({
      confirm_fail_count: nextCount,
      confirm_fail_reset_at: resetAt > now ? lead.confirm_fail_reset_at : new Date(now + WINDOW_MS).toISOString(),
    }).eq('id', lead.id);

    return NextResponse.json({ ok: false, exhausted: nextCount >= MAX_ATTEMPTS, remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextCount) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
