import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// The pending-approval queue for business-number leads (leads.is_business_number) -
// an automated send that would normally go straight out lands here instead
// (see src/lib/leadSend.ts's sendToLead()), waiting for an admin to approve
// or reject it by hand from this page's UI. Distinct from Sent
// (/admin/api/lead-funnel/sent), which is a log of what already went out.
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('outbound_message_queue')
    .select('id, lead_id, phone, label, kind, preview_text, status, created_at, reviewed_at, leads(name, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r: any) => {
    const { leads, ...rest } = r;
    return { ...rest, lead_name: leads?.name || null, lead_phone: leads?.phone || rest.phone };
  });

  return NextResponse.json({ rows });
}
