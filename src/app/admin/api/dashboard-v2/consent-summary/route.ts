import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSourceLane } from '@/lib/leadSourceLane';

// Two different consent-capture paths write to `leads`: the irene_* routes
// use consent_marketing/consent_timestamp, the events-page register-interest
// flow uses marketing_consent_at. Both are surfaced here rather than picking
// one and hiding that the fragmentation exists.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('leads').select('source, consent_marketing, marketing_consent_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byLane: Record<string, { total: number; consentMarketing: number; marketingConsentAt: number }> = {};
  (data || []).forEach((l) => {
    const lane = getSourceLane(l.source);
    if (!byLane[lane]) byLane[lane] = { total: 0, consentMarketing: 0, marketingConsentAt: 0 };
    byLane[lane].total++;
    if (l.consent_marketing) byLane[lane].consentMarketing++;
    if (l.marketing_consent_at) byLane[lane].marketingConsentAt++;
  });

  return NextResponse.json({ byLane });
}
