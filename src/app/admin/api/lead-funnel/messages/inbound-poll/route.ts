import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Backs the front-and-centre inbound-message popup (InboundMessageAlert)
// and Message Activity's own live-refresh. Polling rather than Supabase
// Realtime deliberately - leads/messages have zero anon/authenticated RLS
// policies since the RLS lockdown (service-role only), so a browser-side
// Realtime subscription would just receive nothing. This stays behind the
// same admin-only, service-role-backed route every other lead-funnel read
// already uses, rather than reopening that lockdown.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const since = new URL(req.url).searchParams.get('since');
  if (!since) return NextResponse.json({ error: 'since is required' }, { status: 400 });

  // Captured before the query runs, not after - the client advances its
  // cursor to this value, so a message inserted mid-request is picked up
  // on the next poll rather than silently skipped.
  const serverTime = new Date().toISOString();

  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select('id, lead_id, body, media_type, created_at')
    .eq('direction', 'inbound')
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!messages || messages.length === 0) return NextResponse.json({ rows: [], serverTime });

  const leadIds = Array.from(new Set(messages.map(m => m.lead_id)));
  const { data: leads, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('id, name, phone, is_blocked')
    .in('id', leadIds);

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  const leadsById = new Map((leads || []).map(l => [l.id, l]));

  // Blocked leads are meant to be invisible to every downstream view/alert
  // once an admin has blocked them (see whatsapp-webhook/route.ts) - a
  // popup notification is exactly that kind of alert.
  const rows = messages
    .filter(m => !leadsById.get(m.lead_id)?.is_blocked)
    .map(m => {
      const lead = leadsById.get(m.lead_id);
      return {
        id: m.id,
        lead_id: m.lead_id,
        lead_name: lead?.name || null,
        lead_phone: lead?.phone || null,
        body: m.body,
        media_type: m.media_type,
        created_at: m.created_at,
      };
    });

  return NextResponse.json({ rows, serverTime });
}
