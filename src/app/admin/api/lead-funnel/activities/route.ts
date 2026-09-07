import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from '@/lib/contactLog';

// Feed of a lead's contact-attempt outcomes (channel, direction, outcome,
// who logged it, optionally what it was for). Written by two sources:
// the webhook's pipeline-alert buttons/reply-capture flow (channel
// 'whatsapp', its own outcome vocabulary, no `objective`), and - as of the
// POST below - the admin-facing contact log (any CONTACT_CHANNELS/
// CONTACT_OUTCOMES value, `objective` set). Both write into the same
// free-text columns; see src/lib/contactLog.ts for why that's fine.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// Admin-authored contact log entry. Also clears leads.needs_human, mirroring
// the webhook's STATUS_BUTTONS behavior (src/app/api/whatsapp-webhook/route.ts)
// so a lead logged as contacted from either surface stops showing "Needs
// Reply" everywhere else.
export async function POST(req: Request) {
  try {
    const { leadId, channel, outcome, objective, note, createdBy, occurredAt } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    if (!CONTACT_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: `channel must be one of: ${CONTACT_CHANNELS.join(', ')}` }, { status: 400 });
    }
    if (!CONTACT_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: `outcome must be one of: ${CONTACT_OUTCOMES.join(', ')}` }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('lead_activities')
      .insert([{
        lead_id: leadId,
        channel,
        direction: 'outbound',
        outcome,
        objective: objective || null,
        note: note?.trim() || null,
        created_by: createdBy || null,
        created_at: occurredAt || undefined,
      }])
      .select()
      .single();
    if (error) throw error;

    await supabase.from('leads').update({ needs_human: false }).eq('id', leadId);

    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Removing a genuinely mis-logged entry. No PATCH - the log stays
// append-only, same as lead_notes/lead_stage_history, so a correction is a
// delete-and-relog rather than a silent edit of what was actually recorded.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('lead_activities').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
