import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FUNNEL_STAGES } from '@/lib/funnelStages';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INHOUSE_TAG = 'inhouse';
const DAY_MS = 24 * 60 * 60 * 1000;

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Turns leads.status (a single current value) + lead_status_history (an
// append-only log of when it changed) into, per lead: how long they've
// been in their current stage, and how many outbound messages were sent
// while they were in it. Also aggregates, per stage: how many leads are
// there now, and - for leads who have since moved on - the average number
// of messages it took to move them out of that stage. That second number
// is the actual "messages needed to advance" ROI figure that was asked for;
// it only exists for *completed* stage periods, not leads still sitting in
// a stage today (their count is still rising).
export async function GET() {
  const [{ data: leads, error: leadsErr }, { data: history, error: histErr }, { data: messages, error: msgErr }] = await Promise.all([
    supabaseAdmin.from('leads').select('id, name, phone, tags, status, opted_out, created_at'),
    supabaseAdmin.from('lead_status_history').select('lead_id, status, changed_at').order('changed_at', { ascending: true }),
    supabaseAdmin.from('messages').select('lead_id, created_at').eq('direction', 'outbound'),
  ]);

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 });
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const historyByLead = new Map<string, { status: string; changed_at: string }[]>();
  for (const h of history || []) {
    if (!historyByLead.has(h.lead_id)) historyByLead.set(h.lead_id, []);
    historyByLead.get(h.lead_id)!.push(h);
  }

  const messagesByLead = new Map<string, number[]>();
  for (const m of messages || []) {
    if (!messagesByLead.has(m.lead_id)) messagesByLead.set(m.lead_id, []);
    messagesByLead.get(m.lead_id)!.push(new Date(m.created_at).getTime());
  }

  const now = Date.now();
  const completedPeriods: { stage: string; messages: number; isInhouse: boolean }[] = [];
  const leadSummaries: any[] = [];

  for (const lead of leads || []) {
    const isInhouse = (lead.tags || []).some((t: string) => t.toLowerCase() === INHOUSE_TAG);
    let hist = historyByLead.get(lead.id) || [];
    if (hist.length === 0) {
      // Shouldn't happen once every writer records history, but a lead
      // created before that was wired up (or the backfill hasn't run yet)
      // still needs a starting point.
      hist = [{ status: lead.status, changed_at: lead.created_at }];
    }
    const leadMessageTimes = (messagesByLead.get(lead.id) || []).sort((a, b) => a - b);

    let currentStageStart = hist[0].changed_at;
    let currentStageMessages = 0;

    for (let i = 0; i < hist.length; i++) {
      const periodStart = new Date(hist[i].changed_at).getTime();
      const periodEnd = i + 1 < hist.length ? new Date(hist[i + 1].changed_at).getTime() : now;
      const messagesInPeriod = leadMessageTimes.filter(t => t >= periodStart && t < periodEnd).length;

      if (i === hist.length - 1) {
        currentStageStart = hist[i].changed_at;
        currentStageMessages = messagesInPeriod;
      } else {
        completedPeriods.push({ stage: hist[i].status, messages: messagesInPeriod, isInhouse });
      }
    }

    leadSummaries.push({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      tags: lead.tags || [],
      opted_out: lead.opted_out,
      status: lead.status,
      stageStartedAt: currentStageStart,
      daysInStage: round1((now - new Date(currentStageStart).getTime()) / DAY_MS),
      messagesInStage: currentStageMessages,
    });
  }

  const stages = FUNNEL_STAGES.map(stage => {
    const current = leadSummaries.filter(l => l.status === stage && !(l.tags || []).some((t: string) => t.toLowerCase() === INHOUSE_TAG));
    const completed = completedPeriods.filter(p => p.stage === stage && !p.isInhouse);
    return {
      stage,
      count: current.length,
      avgDaysInStage: current.length ? round1(avg(current.map(l => l.daysInStage))) : 0,
      avgMessagesToAdvance: completed.length ? round1(avg(completed.map(p => p.messages))) : null,
      advancedCount: completed.length,
    };
  });

  return NextResponse.json({ stages, leads: leadSummaries });
}
