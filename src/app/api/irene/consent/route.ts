import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Bump this whenever the consent copy shown in the tier modal changes, so
// stored consent always records exactly what the parent agreed to.
const CONSENT_WORDING_VERSION = '2026-08-11-v1';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voter_id, whatsapp_number, consent_marketing, parent_first_name, grade, class_name } = body;

    if (!voter_id || typeof consent_marketing !== 'boolean') {
      return NextResponse.json({ error: 'voter_id and consent_marketing are required' }, { status: 400 });
    }

    // Service role, not anon - this route is server-only and also writes to
    // leads, same reasoning as the WhatsApp webhook's switch away from anon.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Real client IP as consent evidence - the vote/voter flow runs entirely
    // client-side against Supabase, which can't see the caller's public IP,
    // so this is the one step that has to go through a server route.
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const { data: voter, error: voterError } = await supabase
      .from('irene_voters')
      .update({
        consent_marketing,
        consent_timestamp: new Date().toISOString(),
        consent_wording_version: CONSENT_WORDING_VERSION,
        consent_source: 'irene_voting_platform',
        consent_ip_address: ipAddress,
        parent_first_name: parent_first_name || null,
        grade: grade || null,
        class_name: class_name || null,
      })
      .eq('id', voter_id)
      .select()
      .single();

    if (voterError) throw voterError;

    // Only consented, WhatsApp-reachable voters enter the lead engine.
    if (consent_marketing && whatsapp_number) {
      const phone = String(whatsapp_number).replace(/\D/g, '');

      // Insert-first relies on leads.phone's UNIQUE constraint to atomically
      // reject a duplicate - same pattern as the WhatsApp webhook, so this
      // can't reintroduce the race condition that was closed there.
      const { data: newLead } = await supabase
        .from('leads')
        .insert([{
          phone,
          status: 'new_lead',
          source: 'irene_ips',
          school: 'Irene Primary',
          class: class_name || null,
          name: parent_first_name || null,
          consent_marketing: true,
          consent_timestamp: new Date().toISOString(),
          consent_wording_version: CONSENT_WORDING_VERSION,
          consent_source: 'irene_voting_platform',
        }])
        .select()
        .single();

      // On conflict, an existing lead already owns this phone number - leave
      // its funnel status and prior data alone rather than overwrite it.
      if (!newLead) {
        console.log(`ℹ️ Irene consent: ${phone} already has a lead record, left as-is.`);
      }
    }

    return NextResponse.json({ ok: true, voter });
  } catch (error: any) {
    console.error('Irene consent route error:', error);
    return NextResponse.json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
