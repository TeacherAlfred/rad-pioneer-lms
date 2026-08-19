import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/registerInterest';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SOP §3 step 1: email match check. Only ever returns booleans - never the
// lead's actual name/phone/etc, so a visitor can't fish for someone else's
// details by guessing an email.
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, phone')
      .ilike('email', email.trim())
      .maybeSingle();

    return NextResponse.json({
      found: !!lead,
      hasWhatsapp: !!lead && normalizePhone(lead.phone).length >= 4,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
