import { STAGE_STALL_HOURS } from '@/lib/funnelStages';
import { isResponsiveOutcome } from '@/lib/contactLog';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Global warmth, independent of stage - spec §3. Extracted from the nightly
// cron (src/app/api/lead-funnel/cron/route.ts) so the call queue's sort can
// reuse the exact same signal rather than recomputing a parallel version.
export function computeEngagementRecency(lastInboundAt: string | null, createdAt: string): string {
  const reference = lastInboundAt || createdAt;
  const ageMs = Date.now() - new Date(reference).getTime();
  if (ageMs <= 14 * DAY_MS) return 'active';
  if (ageMs <= 45 * DAY_MS) return 'cooling';
  if (ageMs <= 120 * DAY_MS) return 'dormant';
  return 'cold';
}

// Per-stage staleness - how long they've sat in THIS stage vs. its expected
// window (spec §2/§3). Terminal stages don't stall.
export function computeStageHealth(stage: string, stageEnteredAt: string, engagementRecency: string): string {
  if (stage === 'won' || stage === 'lost' || stage === 'opted_out') return 'active';
  const stallHours = STAGE_STALL_HOURS[stage] ?? Infinity;
  const hoursInStage = (Date.now() - new Date(stageEnteredAt).getTime()) / HOUR_MS;
  if (hoursInStage <= stallHours) return 'active';
  return engagementRecency === 'dormant' || engagementRecency === 'cold' ? 'dormant' : 'stalled';
}

// Call-queue sort: urgency first, responsiveness only as a tiebreak among
// equally-urgent leads (RAD_Lead_Contact_Log request, 2026-09-07) - a queue
// sorted by ease alone quietly starves the leads who need the most
// follow-through. Lower rank = more urgent = called first.
export function urgencyRank(lead: { needs_human?: boolean | null; stage_health?: string | null; engagement_recency?: string | null }): number {
  if (lead.needs_human) return 0;
  if (lead.stage_health === 'stalled') return 1;
  if (lead.stage_health === 'dormant') return 2;
  if (lead.engagement_recency === 'cold') return 3;
  if (lead.engagement_recency === 'dormant') return 4;
  if (lead.engagement_recency === 'cooling') return 5;
  return 6;
}

// Proportion of a lead's past logged contacts that went somewhere (not
// no-answer/not-interested). Leads with no history get a neutral 0.5 so
// they don't jump the queue in either direction. Used only as a tiebreak
// within the same urgencyRank tier - the confirmed direction is
// less-responsive-first, so equally-urgent leads don't quietly get sorted
// by ease.
export function responsivenessScore(activities: { outcome: string }[]): number {
  if (activities.length === 0) return 0.5;
  const responsive = activities.filter(a => isResponsiveOutcome(a.outcome)).length;
  return responsive / activities.length;
}
