import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// SA-local numbers are stored digits-only with the leading 0 intact (see
// submit/route.ts's waDigits) - a visitor typing their number with a +27
// country code needs converting back to that same local form to match,
// same 0<->27 swap already used by toWaPhone/formatWhatsAppNumber elsewhere.
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) return '0' + digits.slice(2);
  return digits;
}

// Self-serve "stop showing my family publicly" - deliberately just flips the
// same consent_public_display flag the feed and vote routes already gate on,
// verified by the same WhatsApp/email the family originally gave (already a
// unique, required identifier on the row - no new verification system).
// Full data deletion is NOT handled here on purpose: that's the contact form,
// reviewed by a person, not a self-serve destructive action off a low-bar
// lookup like this one.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { contact } = body as { contact?: string };
  const trimmed = typeof contact === 'string' ? contact.trim() : '';
  if (!trimmed) {
    return NextResponse.json({ error: 'Enter the WhatsApp number or email you signed up with' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const isEmail = trimmed.includes('@');

  const { data: family, error: findError } = isEmail
    ? await supabase.from('irene_fitness_families').select('id').ilike('email', trimmed).maybeSingle()
    : await supabase.from('irene_fitness_families').select('id').eq('whatsapp', normalizePhone(trimmed)).maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!family) return NextResponse.json({ found: false });

  const { error: updateError } = await supabase
    .from('irene_fitness_families')
    .update({ consent_public_display: false, consent_public_display_timestamp: new Date().toISOString() })
    .eq('id', family.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: response } = await supabase
    .from('irene_fitness_responses')
    .select('display_name')
    .eq('family_id', family.id)
    .maybeSingle();

  return NextResponse.json({ found: true, display_name: response?.display_name || null });
}
