import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStatusChange } from '@/lib/leadStatusHistory';
import { FUNNEL_STAGES } from '@/lib/funnelStages';
import { parseOutboundLabel, isFailedOutbound } from '@/lib/outboundMessageLabel';

// Service role: leads has zero anon RLS policies since the 2026-08-12
// lockdown, so a browser-side client can no longer read this table directly.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Recent-activity window, not a full history fetch - same "activity feed,
// not export tool" tradeoff as Message Activity. Ordered newest-first, so
// the first row seen per lead is already its most recent outbound send.
const RECENT_OUTBOUND_LIMIT = 3000;

export async function GET() {
  // households(name) relies on the leads.household_id FK - Supabase embeds
  // the related row automatically once that constraint exists.
  const [{ data, error }, { data: outbound, error: outboundError }] = await Promise.all([
    supabaseAdmin.from('leads').select('*, households(name)').order('created_at', { ascending: false }),
    supabaseAdmin
      .from('messages')
      .select('lead_id, created_at, body')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(RECENT_OUTBOUND_LIMIT),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (outboundError) return NextResponse.json({ error: outboundError.message }, { status: 500 });

  const lastSentByLead = new Map<string, { created_at: string; body: string }>();
  for (const m of outbound || []) {
    if (!lastSentByLead.has(m.lead_id)) lastSentByLead.set(m.lead_id, m);
  }

  const rows = (data || []).map((r: any) => {
    const { households, ...rest } = r;
    const lastSent = lastSentByLead.get(r.id);
    return {
      ...rest,
      household_name: households?.name || null,
      last_sent_at: lastSent?.created_at || null,
      last_sent_label: lastSent ? parseOutboundLabel(lastSent.body) : null,
      last_sent_failed: lastSent ? isFailedOutbound(lastSent.body) : false,
    };
  });
  return NextResponse.json({ rows });
}

// Edits tags, status, household_id, is_potential_student, and/or the lead's
// own contact details (name, phone, email, school, class, children_names).
// Status edits are the manual path (from the stages dashboard) for outcomes
// the bot/admin-button flow can't set itself - primarily converted/lost, but
// any stage can be corrected here. household_id: null unlinks a lead from
// its household (linking 2+ leads together is a separate action - see
// household/route.ts). Notes are a separate running log, not a field here -
// see notes/route.ts.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, tags, status, household_id, name, phone, email, school, children_names, is_potential_student } = body;
    // "class" is a reserved word, can't destructure it bare above.
    const className = body.class;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
    }
    if (children_names !== undefined && children_names !== null && !Array.isArray(children_names)) {
      return NextResponse.json({ error: 'children_names must be an array' }, { status: 400 });
    }
    if (status !== undefined && !FUNNEL_STAGES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${FUNNEL_STAGES.join(', ')}` }, { status: 400 });
    }
    if (phone !== undefined && !String(phone).trim()) {
      return NextResponse.json({ error: 'Phone cannot be empty' }, { status: 400 });
    }

    const update: Record<string, any> = {};
    if (tags !== undefined) update.tags = tags;
    if (household_id !== undefined) update.household_id = household_id;
    if (name !== undefined) update.name = name || null;
    // Normalized to digits only, same format the webhook stores/matches on -
    // an admin typing "+27 82 123 4567" must still match future inbound
    // messages from that number.
    if (phone !== undefined) update.phone = String(phone).replace(/\D/g, '');
    if (email !== undefined) update.email = email || null;
    if (school !== undefined) update.school = school || null;
    if (className !== undefined) update.class = className || null;
    if (children_names !== undefined) update.children_names = children_names;
    if (is_potential_student !== undefined) update.is_potential_student = !!is_potential_student;
    if (status !== undefined) {
      update.status = status;
      if (status === 'contacted') update.contacted_at = new Date().toISOString();
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That phone number is already used by another lead.' }, { status: 409 });
      }
      throw error;
    }
    if (status !== undefined) await recordStatusChange(supabaseAdmin, id, status);
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
