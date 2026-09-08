import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// This is an activity feed, not an export tool - capped rather than
// unbounded, same tradeoff as Message Activity.
const LIMIT = 2000;

// Every outbound send attempt, regardless of method - WABA (method='waba',
// the existing Cloud API flow, including admin pipeline alerts that never
// used to touch `messages` at all - see whatsapp-webhook/route.ts's
// notifyAdmin) or a manual desktop-WhatsApp click (method='desktop', logged
// by DesktopSendButton right before opening wa.me). The objective is a
// record of every attempt, so a rejected/failed WABA send belongs here just
// as much as a delivered one - never filtered down to "successes only".
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .select('id, lead_id, direction, body, method, recipient_phone, wamid, status, status_updated_at, error_code, error_detail, meta_message_status, created_at, leads(name, phone)')
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((m: any) => {
    const { leads, ...rest } = m;
    return {
      ...rest,
      lead_name: leads?.name || null,
      lead_phone: leads?.phone || null,
      // Falls back to the lead's own number for the vast majority of rows
      // (lead-directed sends) - only admin-alert rows set recipient_phone
      // explicitly, since those go to the admin's number about a lead, not
      // to the lead itself.
      recipient_phone: rest.recipient_phone || leads?.phone || null,
    };
  });

  return NextResponse.json({ rows });
}

// Logs a manual "opened WhatsApp Desktop/Web" attempt - see
// DesktopSendButton. No wamid/status is possible for these; they exist
// purely so a message sent by hand still leaves a record.
export async function POST(req: Request) {
  try {
    const { leadId, phone, body } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    if (!body?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        lead_id: leadId,
        direction: 'outbound',
        method: 'desktop',
        recipient_phone: phone,
        body: body.trim(),
      }])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
