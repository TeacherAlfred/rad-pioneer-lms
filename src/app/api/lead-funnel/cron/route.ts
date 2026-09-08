import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordStageChange } from '@/lib/leadStageHistory';
import { computeEngagementRecency, computeStageHealth } from '@/lib/leadUrgency';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';
import { CONTACT_CHANNEL_LABELS, CONTACT_OBJECTIVE_LABELS } from '@/lib/contactLog';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAY_MS = 24 * 60 * 60 * 1000;
const UPDATE_CHUNK_SIZE = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Nightly automation for the lead lifecycle model (RAD_Lead_Stages_and_Followup_Spec.md):
//  1. Recompute engagement_recency + stage_health for every lead.
//  2. Auto-move leads past their interested session's date to won/re_nurture.
//  3. Auto-lost after 180 days of silence with no purchase (reversible on
//     any new inbound - see the webhook's reopen-on-reply logic).
// Each pass is idempotent - safe to re-trigger if the scheduler double-fires
// or this is invoked manually while testing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    // --- PASS 1: engagement_recency + stage_health ---
    const { data: allLeads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, lifecycle_stage, stage_entered_at, last_inbound_at, created_at');
    if (leadsErr) throw leadsErr;

    const healthUpdates = (allLeads || []).map(lead => {
      const engagement_recency = computeEngagementRecency(lead.last_inbound_at, lead.created_at);
      const stage_health = computeStageHealth(lead.lifecycle_stage, lead.stage_entered_at, engagement_recency);
      return { id: lead.id, engagement_recency, stage_health };
    });
    for (const batch of chunk(healthUpdates, UPDATE_CHUNK_SIZE)) {
      const { error } = await supabaseAdmin.from('leads').upsert(batch);
      if (error) throw error;
    }

    // --- PASS 2: session-expiry auto-move ---
    // "Offers expire when events happen" - a lead qualified/offered against
    // a session that already ran either attended (-> won) or didn't (->
    // re_nurture, tagged with the session they missed, spec §3).
    const { data: sessionLeads, error: sessionLeadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, lifecycle_stage, interested_session_id, sessions(starts_at)')
      .in('lifecycle_stage', ['qualified', 'offered'])
      .not('interested_session_id', 'is', null);
    if (sessionLeadsErr) throw sessionLeadsErr;

    let sessionMoves = 0;
    for (const lead of sessionLeads || []) {
      const session = (lead as any).sessions;
      if (!session?.starts_at || new Date(session.starts_at).getTime() >= Date.now()) continue;

      const { data: guardianKids } = await supabaseAdmin
        .from('kid_guardians')
        .select('kid_id')
        .eq('lead_id', lead.id);
      const kidIds = (guardianKids || []).map(g => g.kid_id);

      let attended = false;
      if (kidIds.length > 0) {
        const { data: attendance } = await supabaseAdmin
          .from('enrolments')
          .select('id')
          .eq('session_id', lead.interested_session_id)
          .eq('attended', true)
          .in('student_id', kidIds)
          .limit(1);
        attended = !!attendance && attendance.length > 0;
      }

      const toStage = attended ? 'won' : 're_nurture';
      const update: Record<string, any> = { lifecycle_stage: toStage, stage_entered_at: new Date().toISOString() };
      if (attended) {
        update.is_customer = true;
        update.first_purchase_at = new Date().toISOString();
        update.last_purchase_at = new Date().toISOString();
      }
      await supabaseAdmin.from('leads').update(update).eq('id', lead.id);
      await recordStageChange(supabaseAdmin, lead.id, {
        fromStage: lead.lifecycle_stage,
        toStage,
        changedBy: 'cron',
        reason: attended ? 'attended_session' : `missed_session:${lead.interested_session_id}`,
      });
      sessionMoves++;
    }

    // --- PASS 3: auto-lost after 180 days ---
    const { data: staleCandidates, error: staleErr } = await supabaseAdmin
      .from('leads')
      .select('id, lifecycle_stage, last_inbound_at, created_at')
      .eq('is_customer', false)
      .not('lifecycle_stage', 'in', '(lost,opted_out)');
    if (staleErr) throw staleErr;

    const cutoff = Date.now() - 180 * DAY_MS;
    const toAutoLose = (staleCandidates || []).filter(lead => {
      const reference = lead.last_inbound_at || lead.created_at;
      return new Date(reference).getTime() < cutoff;
    });

    for (const lead of toAutoLose) {
      await supabaseAdmin.from('leads').update({
        lifecycle_stage: 'lost',
        lost_reason: 'auto_expired',
        stage_entered_at: new Date().toISOString(),
      }).eq('id', lead.id);
      await recordStageChange(supabaseAdmin, lead.id, {
        fromStage: lead.lifecycle_stage,
        toStage: 'lost',
        changedBy: 'cron',
        reason: 'auto_expired',
      });
    }

    // --- PASS 4: contact-response review flags ---
    // A "what I did" logged with no captured response 24h later gets
    // flagged and the admin notified - never auto-marked. Per the two-phase
    // contact log (2026-09-08), only a human confirming from the Needs
    // Response view (bulk "mark as no response" or capturing the real
    // outcome) ever writes a value into `outcome` - this pass just raises
    // the flag and alerts, it doesn't decide anything on its own.
    const { data: overdueActivities, error: overdueErr } = await supabaseAdmin
      .from('lead_activities')
      .select('id, lead_id, channel, objective, created_at, leads(name, phone)')
      .is('outcome', null)
      .eq('needs_response_review', false)
      .not('response_due_at', 'is', null)
      .lte('response_due_at', new Date().toISOString());
    if (overdueErr) throw overdueErr;

    let flaggedForReview = 0;
    if (overdueActivities && overdueActivities.length > 0) {
      await supabaseAdmin.from('lead_activities').update({ needs_response_review: true }).in('id', overdueActivities.map((a: any) => a.id));
      flaggedForReview = overdueActivities.length;

      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      if (adminPhone) {
        const shown = overdueActivities.slice(0, 25);
        const lines = shown.map((a: any) => `• ${a.leads?.name || 'Unnamed'} +${a.leads?.phone || '?'} — ${CONTACT_CHANNEL_LABELS[a.channel] || a.channel}${a.objective ? ` (${CONTACT_OBJECTIVE_LABELS[a.objective] || a.objective})` : ''}`);
        const overflow = overdueActivities.length - shown.length;
        const alertText = `⏰ *Needs Response Review* (${overdueActivities.length})\n\nNo response captured 24h+ after these contacts - confirm or capture the real outcome in the Call Queue's Needs Response tab:\n\n${lines.join('\n')}${overflow > 0 ? `\n\n…and ${overflow} more.` : ''}`;
        const result = await sendWhatsAppMessage(adminPhone, { type: 'text', text: { body: alertText } });
        // lead_id is null here - this alert is about several leads at once,
        // not any single one (see messages.lead_id's nullable FK).
        await supabaseAdmin.from('messages').insert([{
          lead_id: null,
          direction: 'outbound',
          method: 'waba',
          recipient_phone: adminPhone,
          body: `[Admin Alert] ${alertText}`,
          wamid: result.wamid || null,
          status: result.ok ? null : 'failed',
          error_code: result.errorCode || null,
          error_detail: result.ok ? null : (result.error || null),
          meta_message_status: result.messageStatus || null,
        }]);
      }
    }

    return NextResponse.json({
      success: true,
      healthRecomputed: healthUpdates.length,
      sessionMoves,
      autoLost: toAutoLose.length,
      flaggedForReview,
    });
  } catch (error: any) {
    console.error('Lead-funnel cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
