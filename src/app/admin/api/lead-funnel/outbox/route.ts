import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// The pending-approval queue - a send lands here instead of going straight
// out either because the lead is flagged is_business_number, or the
// bot_flows row that produced it is flagged requires_approval (or both -
// see `reason`), per src/lib/leadSend.ts's sendToLead(). Distinct from Sent
// (/admin/api/lead-funnel/sent), which is a log of what already went out.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('outbound_message_queue')
    .select('id, lead_id, phone, label, kind, send_payload, preview_text, status, reason, created_at, reviewed_at, leads(name, phone), bot_flows(id, label)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Editable in the Outbox UI only when the underlying freeform payload has
  // a flat text field to rewrite - a document/media header has no such
  // field, and a template's wording is Meta-enforced, never editable here.
  const rows = (data || []).map((r: any) => {
    const { leads, bot_flows, send_payload, ...rest } = r;
    const p = send_payload?.payload;
    const editable = r.kind === 'freeform' && !!(p?.text?.body !== undefined || p?.interactive?.body?.text !== undefined);
    return {
      ...rest,
      lead_name: leads?.name || null,
      lead_phone: leads?.phone || rest.phone,
      flow_label: bot_flows?.label || null,
      editable,
    };
  });

  return NextResponse.json({ rows });
}
