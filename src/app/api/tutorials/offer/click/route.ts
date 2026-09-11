import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : null) || req.headers.get('x-real-ip') || 'unknown';
}

// Logs a click on the S6 offer from either placement (hub_card or
// series_completion), carrying the session's attribution (S8) and, if the
// visitor has already linked a phone, which one - so RAD can eventually
// tell which campaign actually converts through the offer, not just which
// one drives traffic. Best-effort: a logging failure must never block the
// visitor's navigation to the offer's destination, so this never throws
// past a 200/ok:false.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { offerId, placement, seriesId, tutorialId, progressToken, utm_source, utm_medium, utm_campaign, referrer } = body;

  if (!placement || !['hub_card', 'series_completion'].includes(placement)) {
    return NextResponse.json({ ok: false, error: 'placement must be hub_card or series_completion' }, { status: 400 });
  }

  let tutorialVisitorId: string | null = null;
  if (progressToken) {
    const { data: tokenRow } = await supabaseAdmin
      .from('tutorial_progress_tokens')
      .select('tutorial_visitor_id, revoked_at')
      .eq('token', progressToken)
      .maybeSingle();
    if (tokenRow && !tokenRow.revoked_at) tutorialVisitorId = tokenRow.tutorial_visitor_id;
  }

  await supabaseAdmin.from('tutorial_offer_clicks').insert([{
    offer_id: offerId || null,
    placement,
    series_id: seriesId || null,
    tutorial_id: tutorialId || null,
    tutorial_visitor_id: tutorialVisitorId,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    referrer: referrer || null,
    ip_address: clientIp(req),
  }]);

  return NextResponse.json({ ok: true });
}
