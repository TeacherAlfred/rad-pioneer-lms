import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { LIFECYCLE_STAGES } from '@/lib/funnelStages';
import { parseOutboundLabel, isFailedOutbound } from '@/lib/outboundMessageLabel';
import { applyLeadRole, roleFromLead, SEGMENT_PARENT_TAG, SEGMENT_STUDENT_TAG, LeadRole } from '@/lib/leadRole';

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
    supabaseAdmin.from('leads').select('*, households(name)').is('merged_into_id', null).order('created_at', { ascending: false }),
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
  // Separate from lastSent: an [Admin Alert] row is a message TO the admin
  // ABOUT the lead, a [Queued...] row hasn't gone out yet and a [FAILED...]
  // row never arrived - none of those mean the lead actually received
  // something, which is what the "hide recently messaged" filter needs.
  const lastReceivedByLead = new Map<string, string>();
  for (const m of outbound || []) {
    if (!lastSentByLead.has(m.lead_id)) lastSentByLead.set(m.lead_id, m);
    const b = m.body || '';
    if (!lastReceivedByLead.has(m.lead_id) && !b.startsWith('[Admin Alert]') && !b.startsWith('[Queued') && !b.startsWith('[FAILED')) {
      lastReceivedByLead.set(m.lead_id, m.created_at);
    }
  }

  const rows = (data || []).map((r: any) => {
    const { households, ...rest } = r;
    const lastSent = lastSentByLead.get(r.id);
    return {
      ...rest,
      household_name: households?.name || null,
      last_sent_at: lastSent?.created_at || null,
      last_received_at: lastReceivedByLead.get(r.id) || null,
      last_sent_label: lastSent ? parseOutboundLabel(lastSent.body) : null,
      last_sent_failed: lastSent ? isFailedOutbound(lastSent.body) : false,
    };
  });
  return NextResponse.json({ rows });
}

// Edits tags, lifecycle_stage, household_id, is_potential_student,
// is_confirmed_parent, and/or
// the lead's own contact details (name, phone, email, school, class,
// children_names). lifecycle_stage edits are the manual path (from the
// stages dashboard) for transitions the bot/admin-button flow can't set
// itself - qualified/offered/won/lost/opted_out - since detecting those
// from conversation isn't built. household_id: null unlinks a lead from
// its household (linking 2+ leads together is a separate action - see
// household/route.ts). Notes are a separate running log, not a field here -
// see notes/route.ts.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, tags, lifecycle_stage, lost_reason, session_id, household_id, name, phone, email, school, children_names, is_potential_student, is_confirmed_parent, bot_paused, is_blocked, blocked_reason, dismiss_reply, is_business_number, opted_out } = body;
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
    if (lifecycle_stage !== undefined && !LIFECYCLE_STAGES.includes(lifecycle_stage)) {
      return NextResponse.json({ error: `lifecycle_stage must be one of: ${LIFECYCLE_STAGES.join(', ')}` }, { status: 400 });
    }
    // Per spec §7: manual lost requires a reason (auto-expiry writes its own).
    if (lifecycle_stage === 'lost' && !lost_reason) {
      return NextResponse.json({ error: 'lost_reason is required when setting lifecycle_stage to lost' }, { status: 400 });
    }
    if (phone !== undefined && !String(phone).trim()) {
      return NextResponse.json({ error: 'Phone cannot be empty' }, { status: 400 });
    }

    // Needed as the "from" side of the audit row, and to know whether this
    // is actually a stage change at all (vs. a no-op resubmit).
    let previousStage: string | null = null;
    let wasAlreadyCustomer = false;
    if (lifecycle_stage !== undefined) {
      const { data: currentLead } = await supabaseAdmin.from('leads').select('lifecycle_stage, is_customer').eq('id', id).maybeSingle();
      previousStage = currentLead?.lifecycle_stage ?? null;
      wasAlreadyCustomer = !!currentLead?.is_customer;
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
    // Parent/student is one answer kept in four places - see lib/leadRole.ts.
    // The two toggles, an explicit `role`, and hand-added/removed
    // segment_parent / segment_student tags all resolve to one role change
    // applied after the main update, rather than each writing its own column.
    let roleTarget: LeadRole | undefined;
    if (body.role !== undefined) {
      roleTarget = body.role === 'parent' || body.role === 'student' ? body.role : null;
    } else if (is_confirmed_parent !== undefined || is_potential_student !== undefined || tags !== undefined) {
      const { data: cur } = await supabaseAdmin.from('leads').select('is_confirmed_parent, is_potential_student, tags').eq('id', id).maybeSingle();
      const curRole = roleFromLead(cur || {});
      if (is_confirmed_parent !== undefined) {
        if (is_confirmed_parent) roleTarget = 'parent';
        else if (curRole === 'parent') roleTarget = null;
      }
      if (is_potential_student !== undefined && roleTarget === undefined) {
        if (is_potential_student) roleTarget = 'student';
        else if (curRole === 'student') roleTarget = null;
      }
      if (roleTarget === undefined && tags !== undefined) {
        const tagRole = (t: string[]): LeadRole => t.includes(SEGMENT_PARENT_TAG) ? 'parent' : t.includes(SEGMENT_STUDENT_TAG) ? 'student' : null;
        const incoming = tagRole(tags);
        if (incoming !== tagRole(cur?.tags || [])) roleTarget = incoming;
      }
    }
    if (bot_paused !== undefined) {
      update.bot_paused = !!bot_paused;
      update.bot_paused_at = bot_paused ? new Date().toISOString() : null;
    }
    if (is_blocked !== undefined) {
      update.is_blocked = !!is_blocked;
      update.blocked_at = is_blocked ? new Date().toISOString() : null;
      update.blocked_reason = is_blocked ? (blocked_reason || null) : null;
    }
    // Gates every automated send to this lead through the pending-approval
    // queue instead of Meta - see src/lib/leadSend.ts's sendToLead() and
    // /admin/lead-funnel/outbox. Unlike is_blocked, no companion reason
    // field - there's nothing to record beyond the flag itself.
    if (is_business_number !== undefined) update.is_business_number = !!is_business_number;
    // Standalone reversal of the webhook's "stop"/"unsubscribe" keyword
    // handler (and of the lifecycle_stage === 'opted_out' branch below,
    // which only ever sets this true) - previously there was no way to flip
    // this back to false at all, so an accidental "stop" or a changed mind
    // had no undo. Independent of lifecycle_stage on purpose: opting back in
    // doesn't imply any particular stage, and the compliance gates that
    // actually matter (send-template, the nurture cron) read this flag
    // directly, not lifecycle_stage.
    if (opted_out !== undefined) {
      update.opted_out = !!opted_out;
      update.opted_out_at = opted_out ? new Date().toISOString() : null;
      // An admin opting someone out is a confirmed stop; reactivating clears
      // the whole opt-out history flag (pending/cancelled included).
      update.opt_out_state = opted_out ? 'confirmed' : null;
    }
    // Message Activity's "Needs Reply" flag is purely derived (last message
    // is inbound) - dismissing it just stamps "don't flag the inbound
    // message that's already here", not a permanent silence. The next
    // inbound message is necessarily newer than this timestamp, so the flag
    // reappears on its own with no explicit re-arm step.
    if (dismiss_reply !== undefined) {
      update.reply_dismissed_at = dismiss_reply ? new Date().toISOString() : null;
    }
    if (lifecycle_stage !== undefined) {
      update.lifecycle_stage = lifecycle_stage;
      update.stage_entered_at = new Date().toISOString();
      if (lifecycle_stage === 'lost') update.lost_reason = lost_reason;
      if (lifecycle_stage !== 'lost') update.lost_reason = null;
      if (lifecycle_stage === 'opted_out') { update.opted_out = true; update.opted_out_at = new Date().toISOString(); update.opt_out_state = 'confirmed'; }
      // is_customer never regresses - won is the only stage that sets it.
      if (lifecycle_stage === 'won') {
        update.is_customer = true;
        if (!wasAlreadyCustomer) update.first_purchase_at = new Date().toISOString();
        update.last_purchase_at = new Date().toISOString();
      }
      // qualified/offered are the stages a lead is tracked against a
      // specific session (spec §3/§6) - session_id is optional since not
      // every qualified/offered lead has picked one yet.
      if ((lifecycle_stage === 'qualified' || lifecycle_stage === 'offered') && session_id !== undefined) {
        update.interested_session_id = session_id || null;
      }
    }
    if (Object.keys(update).length === 0 && roleTarget === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    let data: any = null;
    let error: any = null;
    if (Object.keys(update).length > 0) {
      ({ data, error } = await supabaseAdmin
        .from('leads')
        .update(update)
        .eq('id', id)
        .select()
        .single());
    }

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'That phone number is already used by another lead.' }, { status: 409 });
      }
      throw error;
    }
    if (lifecycle_stage !== undefined && lifecycle_stage !== previousStage) {
      await recordStageChange(supabaseAdmin, id, {
        fromStage: previousStage,
        toStage: lifecycle_stage,
        changedBy: 'admin',
        reason: lifecycle_stage === 'lost' ? lost_reason : null,
      });
    }
    if (roleTarget !== undefined) {
      await applyLeadRole(supabaseAdmin, id, roleTarget);
      const { data: refreshed, error: refreshErr } = await supabaseAdmin.from('leads').select('*').eq('id', id).single();
      if (refreshErr) throw refreshErr;
      data = refreshed;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
