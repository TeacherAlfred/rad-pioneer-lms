import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { urgencyRank, responsivenessScore } from '@/lib/leadUrgency';

const LEAD_COLUMNS = 'id, name, phone, company_name, lifecycle_stage, stage_health, engagement_recency, needs_human, is_customer, tags';

// The pre-loadable, ordered "who to call next" list. GET computes the sort
// server-side (manual pins first, then urgency, then responsiveness as a
// tiebreak - see src/lib/leadUrgency.ts) and a lightweight "quick scan"
// payload so a stale queue built days ago gets a fast sanity check at the
// start of a session, not a full rebuild.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('leadId');
  const status = searchParams.get('status') || 'pending';

  const supabase = supabaseAdmin();

  // Per-lead history lookup for the "Add to Queue" quick-action buttons -
  // every status, no urgency/sort scoring, just "has this lead ever been
  // queued before" so a quick-add button can show a Queued chip or warn
  // before a duplicate add. Deliberately a separate, simpler branch rather
  // than reusing the pending-only sorted query below.
  if (leadId) {
    const { data, error } = await supabase
      .from('lead_call_queue')
      .select('*')
      .eq('lead_id', leadId)
      .order('added_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data || [] });
  }

  // 'history' is the "resolved" view (done + skipped, most-recently-
  // completed first) that a lead falls into the moment an outcome is logged
  // for them - see the activities route's POST, which is what actually
  // moves a row from pending to done. Every other status value is an exact
  // match against the single-status urgency-sorted queue below.
  const isHistory = status === 'history';
  let queueQuery = supabase.from('lead_call_queue').select(`*, leads(${LEAD_COLUMNS})`);
  queueQuery = isHistory
    ? queueQuery.in('status', ['done', 'skipped']).order('completed_at', { ascending: false })
    : queueQuery.eq('status', status).order('target_date', { ascending: true }).order('added_at', { ascending: true });
  const { data: queueRows, error } = await queueQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leadIds = (queueRows || []).map((r: any) => r.lead_id);
  const activitiesByLead: Record<string, { outcome: string }[]> = {};
  if (leadIds.length > 0) {
    const { data: activities } = await supabase
      .from('lead_activities')
      .select('lead_id, outcome')
      .in('lead_id', leadIds);
    for (const a of activities || []) {
      (activitiesByLead[a.lead_id] ||= []).push({ outcome: a.outcome });
    }
  }

  const rows = (queueRows || []).map((r: any) => ({
    ...r,
    lead: r.leads,
    _urgencyRank: urgencyRank(r.leads || {}),
    _responsiveness: responsivenessScore(activitiesByLead[r.lead_id] || []),
  }));

  // History is already ordered by completed_at desc from the query above -
  // re-sorting by urgency/priority would scramble "most recently resolved
  // first" into a meaningless order for a list that's no longer active.
  if (!isHistory) {
    rows.sort((a: any, b: any) => {
      const aPinned = a.manual_priority != null;
      const bPinned = b.manual_priority != null;
      if (aPinned && bPinned) return a.manual_priority - b.manual_priority;
      if (aPinned) return -1;
      if (bPinned) return 1;
      if (a._urgencyRank !== b._urgencyRank) return a._urgencyRank - b._urgencyRank;
      if (a._responsiveness !== b._responsiveness) return a._responsiveness - b._responsiveness;
      if (a.target_date !== b.target_date) return a.target_date < b.target_date ? -1 : 1;
      return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
    });
  }

  let stale: any[] = [];
  let suggestions: any[] = [];
  if (status === 'pending') {
    // 'won'/is_customer are deliberately NOT staleness signals - outbound
    // contact to an existing customer is still a legitimate reason to queue
    // them (a referral ask, nurturing them toward their next purchase), not
    // a sign the call is no longer needed. Only 'lost'/'opted_out' genuinely
    // mean the funnel considers this relationship over or declined.
    stale = rows
      .filter((r: any) => r.lead && ['lost', 'opted_out'].includes(r.lead.lifecycle_stage))
      .map((r: any) => ({ id: r.id, lead_id: r.lead_id, lead_name: r.lead?.name, reason: `stage is now ${r.lead.lifecycle_stage}` }));

    const queuedLeadIds = new Set(leadIds);
    const { data: urgentLeads } = await supabase
      .from('leads')
      .select(LEAD_COLUMNS)
      .or('needs_human.eq.true,stage_health.eq.stalled,stage_health.eq.dormant')
      .is('merged_into_id', null)
      .limit(50);
    suggestions = (urgentLeads || [])
      .filter((l: any) => !queuedLeadIds.has(l.id))
      .slice(0, 5);
  }

  return NextResponse.json({ rows, stale, suggestions });
}

// Add a lead to the queue for a target date (defaults to today), optionally
// pinned with a manual priority override for exceptions to the auto-sort.
export async function POST(req: Request) {
  try {
    const { leadId, targetDate, manualPriority } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 });

    const supabase = supabaseAdmin();

    // Belt-and-suspenders: a blocked lead should never enter the queue,
    // even from a page whose row shape doesn't already know is_blocked.
    const { data: lead } = await supabase.from('leads').select('is_blocked').eq('id', leadId).maybeSingle();
    if (lead?.is_blocked) {
      return NextResponse.json({ error: 'This lead is blocked and cannot be queued.' }, { status: 403 });
    }

    // NOTE: target_date is only spread in when actually provided - supabase-js
    // computes the insert's `columns=` list from Object.keys(), which includes
    // keys whose value is `undefined` (unlike JSON.stringify, which drops
    // them from the body). With defaultToNull left at its default (true),
    // that mismatch makes PostgREST insert an explicit NULL for target_date
    // instead of letting the column's `default current_date` apply, tripping
    // its NOT NULL constraint. Omitting the key outright sidesteps the whole
    // footgun rather than relying on `{ defaultToNull: false }` semantics.
    const { data, error } = await supabase
      .from('lead_call_queue')
      .insert([{
        lead_id: leadId,
        ...(targetDate ? { target_date: targetDate } : {}),
        manual_priority: manualPriority ?? null,
      }])
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This lead is already queued.' }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Mark done/skipped (stamps completed_at), or adjust priority/date on an
// existing queue entry.
export async function PATCH(req: Request) {
  try {
    const { id, status, manualPriority, targetDate } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const update: Record<string, any> = {};
    if (status) {
      update.status = status;
      if (status === 'done' || status === 'skipped') update.completed_at = new Date().toISOString();
    }
    if (manualPriority !== undefined) update.manual_priority = manualPriority;
    if (targetDate !== undefined) update.target_date = targetDate;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('lead_call_queue')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Remove a queue entry outright (distinct from "skip", which keeps history).
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('lead_call_queue').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
