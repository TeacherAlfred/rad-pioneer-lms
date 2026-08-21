import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from '@/lib/funnelStages';
import { getSourceLane } from '@/lib/leadSourceLane';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_PIPELINE_STAGES = ['engaged', 'qualified', 'offered'];

export async function GET() {
  const supabase = supabaseAdmin();

  const [{ data: settings }, { data: leads }, { data: landmines }, { data: recentMoves }] = await Promise.all([
    supabase.from('dashboard_settings').select('*').limit(1).single(),
    supabase.from('leads').select('id, lifecycle_stage, stage_health, source, created_at'),
    supabase.from('landmines').select('*').order('title'),
    supabase
      .from('lead_stage_history')
      .select('lead_id, from_stage, to_stage, reason, changed_by, changed_at, leads(name, phone)')
      .eq('changed_by', 'cron')
      .gte('changed_at', new Date(Date.now() - 7 * DAY_MS).toISOString())
      .order('changed_at', { ascending: false })
      .limit(20),
  ]);

  const allLeads = leads || [];

  // 14-day daily new-lead counts, oldest first.
  const now = new Date();
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const count = allLeads.filter((l) => {
      const created = new Date(l.created_at).getTime();
      return created >= dayStart.getTime() && created < dayEnd.getTime();
    }).length;
    dailyCounts.push({ date: dayStart.toISOString().split('T')[0], count });
  }
  const fourteenDayAvg = dailyCounts.reduce((sum, d) => sum + d.count, 0) / 14;

  const activePipelineCount = allLeads.filter((l) => ACTIVE_PIPELINE_STAGES.includes(l.lifecycle_stage)).length;

  const leadVolumeThreshold = settings?.lead_volume_threshold_per_day ?? 10;
  const founderAttentionThreshold = settings?.founder_attention_threshold_per_day ?? 10;
  const activePipelineThreshold = settings?.active_pipeline_threshold ?? 30;

  // Only Lead Volume and Founder Attention are computable from data that
  // actually exists today - Fulfilment Capacity (waitlist/room concurrency)
  // and Recurring Revenue Quality (MRR vs. hire cost) have no tracked data
  // source yet, so they're surfaced as "not yet trackable" rather than faked.
  let constraintState: 'lead_volume' | 'founder_attention' = 'lead_volume';
  let constraintReason = `${fourteenDayAvg.toFixed(1)} new leads/day (14-day avg), below the ${leadVolumeThreshold}/day line`;
  if (fourteenDayAvg >= founderAttentionThreshold || activePipelineCount > activePipelineThreshold) {
    constraintState = 'founder_attention';
    constraintReason =
      activePipelineCount > activePipelineThreshold
        ? `${activePipelineCount} active pipeline conversations, above the ${activePipelineThreshold} line`
        : `${fourteenDayAvg.toFixed(1)} new leads/day (14-day avg), at or above the ${founderAttentionThreshold}/day line`;
  }

  const stageCounts = LIFECYCLE_STAGES.map((stage) => ({
    stage,
    label: LIFECYCLE_STAGE_LABELS[stage],
    count: allLeads.filter((l) => l.lifecycle_stage === stage).length,
  }));

  const stalledCount = allLeads.filter((l) => l.stage_health === 'stalled').length;

  const laneCounts: Record<string, number> = {};
  allLeads.forEach((l) => {
    const lane = getSourceLane(l.source);
    laneCounts[lane] = (laneCounts[lane] || 0) + 1;
  });

  return NextResponse.json({
    constraint: { state: constraintState, reason: constraintReason, fourteenDayAvg, activePipelineCount },
    dailyCounts,
    stageCounts,
    stalledCount,
    laneCounts,
    landmines: landmines || [],
    recentAutoMoves: recentMoves || [],
    thresholds: { leadVolumeThreshold, founderAttentionThreshold, activePipelineThreshold },
    totalLeads: allLeads.length,
  });
}
