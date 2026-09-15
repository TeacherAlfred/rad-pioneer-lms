import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/tutorialProgress';

// Service role: carries an optional phone number, zero anon policies -
// same posture as tutorial_topic_votes. Write-only from the public's
// point of view; only the admin route ever reads these back.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { text, voterId, phone } = await req.json();
    if (!text || !String(text).trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
    if (!voterId) return NextResponse.json({ error: 'voterId is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('tutorial_topic_other_suggestions').insert([{
      text: String(text).trim().slice(0, 300),
      voter_id: voterId,
      phone: phone ? normalizePhone(phone) : null,
    }]);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
