import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Polls the same Graph API list endpoint lead-funnel/templates/route.ts
// already uses, just without the APPROVED-only filter and with
// rejected_reason requested, so a PENDING/REJECTED status is visible here
// too - Meta has no single-template-by-name lookup, only the list.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('template_rollouts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.status !== 'submitted') {
      return NextResponse.json({ row });
    }

    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!wabaId || !token) {
      return NextResponse.json({ error: 'WHATSAPP_BUSINESS_ACCOUNT_ID is not configured' }, { status: 500 });
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,language,status,rejected_reason&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || 'Failed to check status with Meta' }, { status: 500 });
    }

    const match = (data.data || []).find((t: any) => t.name === row.name && t.language === row.language);
    if (!match) {
      // Submitted but not yet showing in the list - Meta indexing lag right
      // after creation. Not an error, just nothing new to report.
      await supabaseAdmin.from('template_rollouts').update({ last_checked_at: new Date().toISOString() }).eq('id', id);
      return NextResponse.json({ row: { ...row, last_checked_at: new Date().toISOString() } });
    }

    const update: Record<string, any> = {
      meta_status: match.status,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (match.status === 'APPROVED') update.status = 'approved';
    if (match.status === 'REJECTED') {
      update.status = 'rejected';
      update.meta_rejected_reason = match.rejected_reason || null;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('template_rollouts')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ row: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
