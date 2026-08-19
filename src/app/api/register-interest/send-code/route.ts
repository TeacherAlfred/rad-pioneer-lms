import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'node:crypto';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = 'RAD Academy <onboarding@updates.radacademy.co.za>';

const COOLDOWN_MS = 45 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

function hashCode(code: string, leadId: string) {
  return createHash('sha256').update(`${code}:${leadId}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
}

// SOP §3 step 3 fallback path. Sent as an emailed code rather than a
// WhatsApp OTP - see the migration note on why WhatsApp OTP isn't wired up
// (needs a pre-approved Meta authentication template that doesn't exist
// here). Sent immediately via Resend rather than through email_queue,
// since a code needs to land before the visitor gives up and closes the
// tab, not on the emails cron's batch cadence.
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, otp_sent_at')
      .ilike('email', email.trim())
      .maybeSingle();

    if (!lead) {
      return NextResponse.json({ error: 'No record found for that email.' }, { status: 404 });
    }

    if (lead.otp_sent_at && Date.now() - new Date(lead.otp_sent_at).getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: 'A code was just sent - check your inbox, or try again in a moment.' }, { status: 429 });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = new Date();

    await supabaseAdmin.from('leads').update({
      otp_code_hash: hashCode(code, lead.id),
      otp_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      otp_sent_at: now.toISOString(),
    }).eq('id', lead.id);

    await resend.emails.send({
      from: SENDER,
      to: email.trim(),
      subject: `Your RAD Academy code: ${code}`,
      html: `
        <div style="font-family: sans-serif; color: #0f172a;">
          <p>Your confirmation code is:</p>
          <p style="font-size: 32px; font-weight: 900; letter-spacing: 0.2em;">${code}</p>
          <p style="font-size: 13px; color: #64748b;">Expires in 10 minutes. If you didn't request this, you can ignore it.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
