import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/tutorialProgress';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Polled by the browser tab that called link-phone/start while the visitor
// switches to WhatsApp and sends "LINK <code>" - the webhook's matching
// branch (src/app/api/whatsapp-webhook/route.ts) is what actually flips
// phone_verified_at and mints the token this returns.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const normalized = normalizePhone(searchParams.get('phone'));
  if (!normalized) return NextResponse.json({ error: 'phone is required' }, { status: 400 });

  const { data: visitor } = await supabaseAdmin
    .from('tutorial_visitors')
    .select('id, phone_verified_at')
    .eq('phone', normalized)
    .maybeSingle();

  if (!visitor?.phone_verified_at) {
    return NextResponse.json({ verified: false });
  }

  const { data: token } = await supabaseAdmin
    .from('tutorial_progress_tokens')
    .select('token')
    .eq('tutorial_visitor_id', visitor.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ verified: true, token: token?.token || null });
}
